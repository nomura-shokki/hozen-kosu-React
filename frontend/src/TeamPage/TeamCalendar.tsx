/**
 * ============================================================
 * ファイル名 : TeamCalendar.tsx
 * 種別       : 画面コンポーネント（班員工数入力状況画面）
 * 概要       : ログイン者が登録した班員の工数入力状況を、日曜〜土曜の1週間分の表で表示する画面。
 *              班員ごとに「勤務（就業形態）」「残業(分)」「入力時間」の3行を並べ、
 *              工数入力OK判定の日は緑色で塗って、入力が済んでいるかをひと目で確認できるようにする。
 *
 * 主な機能   :
 *   - 表示日を含む週（日曜始まり）の班員の工数データを表示
 *   - 日付を選んで「検索」でその日を含む週へ、「前週」「次週」で1週間ずつ移動
 *     （表示日はサーバー側のセッションに保存されるため、画面を開き直しても同じ週が表示される）
 *   - 「入力時間」のセルをクリックすると、その工数データの班員工数履歴詳細画面へ遷移
 *   - 班員が未登録の場合は班員メニュー画面へ戻してメッセージを表示
 *
 * 使用API    : GET  /api/team_calendar/            表示週の班員工数データ取得（kosu/views/team_views.py の TeamCalendar）
 *              POST /api/team_calendar/            表示日をセッションに保存（同上）
 *              POST /api/team_calendar_week_jump/  表示日を1週間前後に移動（kosu/views/team_views.py の TeamCalendarWeekJump）
 * 画面URL    : /team-calendar                      （index.tsx のルーティング定義）
 * 関連ファイル: styles/TeamPage/TeamCalendar.module.css, Components/Loading.tsx, TeamPage/TeamDetail.tsx（詳細画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/TeamPage/TeamCalendar.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数データ1件分（GET /api/team_calendar/ のレスポンス kosu_data の要素。一部の項目のみ定義） */
interface Kosu {
  id: number; // 工数データのID（主キー）。詳細画面のURLに使う
  employee_no3: number; // 従業員番号
  name: string; // 氏名（サーバーからは人員データのIDが届く。この画面では使用していない）
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（この画面では使用していない）
  work_time: string; // 就業形態（出勤・休日出勤・年休 など）。「勤務」行に表示
  time_work: string; // 作業内容（5分ごとの工数区分記号を288文字並べた文字列。"#"=作業なし）
  judgement: boolean; // 工数入力OK/NG判定（true のセルを緑色で塗る）
  over_time: string; // 残業時間（分）。「残業(分)」行にそのまま表示
}

/** 「従業員番号_就業日」（例: "12345_2026-11-09"）をキーに工数データを引ける対応表 */
type KosuMap = {
  [key: string]: Kosu;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 班員工数入力状況画面。
 *
 * 表示時にサーバーのセッションに保存された表示日（なければ今日）を含む週のデータを取得し、
 * 班員×曜日の表で表示する。
 *
 * @returns 班員工数入力状況画面のJSX
 */
const TeamCalendar: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [data, setData] = useState<Kosu[]>([]); // 取得した表示週の工数データ（表の幅の再計算のきっかけに使う）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大の高さ（ウィンドウの高さに合わせる）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の実際の幅（外枠の幅を合わせるのに使う）
  // 表のDOM要素への参照（実際の幅を測るために使う）
  const tableRef = useRef<HTMLTableElement>(null);
  const [searchDays, setSearchDays] = useState<string[]>([]); // 表示週の7日分の日付（日曜〜土曜。"YYYY-MM-DD"）
  const [memberNames, setMemberNames] = useState<[number, string][]>([]); // 班員の一覧（[従業員番号, 氏名] の配列）
  const [kosuMap, setKosuMap] = useState<KosuMap>({}); // 「従業員番号_就業日」から工数データを引く対応表
  // 日付選択欄の値（初期値は今日の日付。toISOString は "YYYY-MM-DDTHH:mm:ss.sssZ" 形式なので先頭10文字を使う）
  // データ取得後はサーバーのセッションに保存された表示日で上書きされる
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // ---------- ヘルパー関数 ----------

  /**
   * 指定日を含む週の日曜日を求める。
   *
   * getDay() は 0=日曜〜6=土曜 を返すため、その日数だけ日付を戻すと日曜日になる。
   * 例: 2026-11-11（水曜。getDay()=3）→ 3日戻して 2026-11-08（日曜）
   *
   * @param dateString - 基準日（"YYYY-MM-DD"）
   * @returns 基準日を含む週の日曜日の Date
   */
  const getNearestSunday = (dateString: string): Date => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - date.getDay());
    return date;
  };

  // ---------- データ取得 ----------

  /**
   * 表示週の班員工数データをサーバーから取得し、表の表示用に state へ保存する。
   *
   * サーバーはセッションに保存された表示日（なければ今日）を含む週（日曜〜土曜）のデータを返す。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ、
   * 400（班員未登録）なら班員メニューへメッセージ付きで遷移する。
   * useEffect の依存配列に入れるため、useCallback で関数を使い回す（毎回作り直さない）。
   *
   * @returns なし（結果は selectedDay / searchDays / memberNames / kosuMap / data / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/team_calendar/ : 以下を取得
      //   Search_day      : セッションに保存された表示日（"YYYY-MM-DD"）
      //   kosu_data       : 表示週の班員の工数データ一覧
      //   member_name_list: 班員の [従業員番号, 氏名] の一覧
      const response = await api.get("/api/team_calendar/");
      const results = response.data.kosu_data || [];
      const searchDayString: string = response.data.Search_day;
      const memberNameList: [number, string][] = response.data.member_name_list || [];
      setMemberNames(memberNameList);

      // 表示日が返ってきた場合: 日付選択欄に反映し、表示週の7日分の日付を作る
      if (searchDayString) {
        setSelectedDay(searchDayString);

        // 表示日を含む週の日曜日から、土曜日までの7日分を "YYYY-MM-DD" 形式で並べる
        const sunday = getNearestSunday(searchDayString);
        const sevenDays: string[] = [];

        for (let i = 0; i < 7; i++) {
          // 日曜日から i 日後の日付（月末をまたいでも setDate が自動で翌月に繰り上げる）
          const date = new Date(sunday);
          date.setDate(sunday.getDate() + i);

          // 月・日は2桁にそろえる（getMonth() は0始まりのため +1 する。例: 11月 → "11"、5日 → "05"）
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          sevenDays.push(`${year}-${month}-${day}`);
        }
        setSearchDays(sevenDays);
      }

      // 表の各セルから工数データをすぐ引けるよう、「従業員番号_就業日」をキーにした対応表を作る
      const newKosuMap: KosuMap = results.reduce((acc: KosuMap, item: Kosu) => {
        acc[`${item.employee_no3}_${item.work_day2}`] = item;
        return acc;
      }, {});
      setKosuMap(newKosuMap);
      setData(results);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // 400: 班員が未登録 → 班員メニューへ戻し、サーバーのメッセージを表示してもらう
        else if (err.response?.status === 400) navigate("/team-menu", { state: { errorMessage: err.response?.data.message } });
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 選択した日付をサーバーのセッションに表示日として保存し、その週のデータを取得し直す。
   *
   * @param day - 表示日にする日付（"YYYY-MM-DD"）
   * @returns なし
   */
  const postData = async (day: string) => {
    setLoading(true);
    setError(null);
    // POST /api/team_calendar/ : 表示日をセッションに保存 → 保存した表示日の週を再取得
    try {await api.post("/api/team_calendar/", { day: day });
      await fetchData(); 
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  };

  /**
   * 「前週」「次週」ボタン押下時の処理。
   *
   * サーバーのセッションに保存された表示日を7日前（前週）または7日後（次週）にずらし、
   * その週のデータを取得し直す。
   *
   * @param direction - 'B': 前週（Before）/ 'A': 次週（After）
   * @returns なし
   */
  const handleWeekJump = async (direction: 'B' | 'A') => {
    setLoading(true);
    setError(null);

    // POST /api/team_calendar_week_jump/ : 表示日を1週間前後に移動 → 移動後の週を再取得
    try {await api.post("/api/team_calendar_week_jump/", { week: direction });
      await fetchData(); 
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  };

  /**
   * 日付選択欄の値が変わったときの処理（選んだ日付を保存するだけで、検索は「検索」ボタンで行う）。
   *
   * @param e - 日付入力欄の変更イベント
   * @returns なし（selectedDay の state を更新）
   */
  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedDay(e.target.value);
  };

  /**
   * 「検索」ボタン押下時の処理。日付が選ばれている場合だけ、その日を含む週を表示する。
   *
   * @returns なし
   */
  const handleSubmit = () => {
    if (selectedDay) {
      postData(selectedDay);
    }
  };

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（fetchData は navigate が変わらない限り同じ関数のため実質1回）: 表示週のデータを取得する
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 初回表示時のみ（依存配列が空）: ウィンドウサイズの変更を監視し、表の外枠の最大の高さを合わせる
  useEffect(() => {
    /** 表の外枠の最大の高さを現在のウィンドウの高さにする */
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight);
    };

    // まず現在の高さで1回設定する
    updateMaxHeight();

    // ウィンドウサイズが変わるたびに高さを設定し直す
    window.addEventListener("resize", updateMaxHeight);

    // 画面を離れるとき（アンマウント時）: 監視を解除する
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // 工数データが変わったとき（＝表の内容が変わったとき）: 表の実際の幅を測り直す
  // （外枠の幅を表の幅に合わせ、余計な横幅が出ないようにするため）
  useEffect(() => {
    /** 表のDOM要素の現在の幅を tableWidth に保存する */
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    // まず現在の幅で1回設定し、ウィンドウサイズ変更時にも測り直す
    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    // 次回の実行前・アンマウント時: 監視を解除する
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [data]);

  // ---------- 表示用の変換 ----------

  /**
   * 作業内容（288文字）から作業をしている時間帯を求め、「開始～終了」の表示用要素を4行分作る。
   *
   * 作業内容は1文字が5分を表し、0文字目が 0:00〜0:05、12文字目が 1:00〜1:05 … のように対応する。
   * "#"（作業なし）以外の文字が続く区間を1つの時間帯とする（休憩 "$" も時間帯に含まれる）。
   * 例: 96〜203文字目が作業 → "8:00～17:00"
   * 時間帯は最大4つまで表示し、足りない分は全角スペースで埋めて各セルの高さをそろえる。
   *
   * @param timeWorkString - 作業内容（288文字でない場合は時間帯なしとして扱う）
   * @returns 4行分の <div> 要素の配列
   */
  const formatTimeWork = (timeWorkString: string) => {
    const timeRanges: string[] = []; // 見つかった時間帯の文字列（例: "8:00～17:00"）
    let start = -1; // 作業中の区間の開始位置（文字の番号）
    let inTimeBlock = false; // 現在、作業中の区間の中にいるか

    // 正しい長さ（24時間 × 12コマ = 288文字）の作業内容だけを処理する
    if (timeWorkString && timeWorkString.length === 288) {
      // 1文字（5分）ずつ調べて、作業の始まりと終わりを探す
      for (let i = 0; i < timeWorkString.length; i++) {
        // 作業なし → 作業あり に変わった位置: 区間の開始を記録する
        if (timeWorkString[i] !== '#' && !inTimeBlock) {
          start = i;
          inTimeBlock = true;
        // 作業あり → 作業なし に変わった位置: 直前の文字までを1つの区間として時刻に変換する
        } else if (timeWorkString[i] === '#' && inTimeBlock) {
          const end = i - 1;
          // 文字の番号 ÷ 12 が「時」、余り × 5 が「分」（例: 99文字目 → 8時15分）
          const startHour = Math.floor(start / 12);
          const startMinute = (start % 12) * 5;
          // 終了時刻は最後の1コマの「終わり」なので5分を足す
          let endHour = Math.floor(end / 12);
          let endMinute = (end % 12) * 5 + 5;

          // 5分を足して60分になった場合は次の時の0分に繰り上げる（例: 8:60 → 9:00）
          if (endMinute === 60) {
            endHour++;
            endMinute = 0;
          }

          // "時:分" の形に整える（分は2桁。時は padStart(1) のためゼロ埋めされず "8:00" のようになる）
          const startTimeStr = `${String(startHour).padStart(1, '0')}:${String(startMinute).padStart(2, '0')}`;
          const endTimeStr = `${String(endHour).padStart(1, '0')}:${String(endMinute).padStart(2, '0')}`;
          timeRanges.push(`${startTimeStr}～${endTimeStr}`);
          inTimeBlock = false;
          start = -1;
        }
      }

      // 最後の文字まで作業が続いていた場合: 終了時刻を 24:00 として区間を追加する
      if (inTimeBlock) {
        const startHour = Math.floor(start / 12);
        const startMinute = (start % 12) * 5;

        const startTimeStr = `${String(startHour).padStart(1, '0')}:${String(startMinute).padStart(2, '0')}`;
        const endTimeStr = '24:00';
        timeRanges.push(`${startTimeStr}～${endTimeStr}`);
      }
    }

    // 時間帯は先頭から4つまでにし、4つに満たない場合は全角スペースで埋める（セルの高さをそろえるため）
    const paddedRanges = timeRanges.slice(0, 4);
    while (paddedRanges.length < 4) {
      paddedRanges.push("　");
    }

    // 時間帯を1行ずつ <div> にする（固定の4行のため key には位置を使う）
    return paddedRanges.map((range, index) => (
      <div key={index}>{range}</div>
    ));
  };

  /**
   * 日付を見出し用の「MM/DD」形式に変換する。
   *
   * @param dateString - 日付（"YYYY-MM-DD"）
   * @returns 表示用の日付（例: "2026-11-09" → "11/09"）
   */
  const displayDate = (dateString: string) => {
    const parts = dateString.split('-');
    return `${parts[1]}/${parts[2]}`;
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      {/* ローディング表示（この位置では loading は常に false のため、フェードアウトして消える） */}
      <Loading isLoading={loading} />
      <div className={styles["team-calendar-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>班員工数入力状況</h1>
        {/* 班員メニュー画面へ戻るリンク */}
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>
        {/* 表示週の切り替え欄 */}
        <div className={styles["select-form"]}>
          {/* 1段目: 日付を選んで「検索」でその日を含む週を表示 */}
          <div className={styles["select-row"]}>
            <label htmlFor="day">日付選択:</label>
            <input
              type="date"
              id="day"
              name="day"
              value={selectedDay}
              onChange={handleDateChange}
              required
            />
            {/* 検索ボタン（読み込み中は押せない） */}
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="orange_button"
            >
              検索
            </button>
          </div>
          {/* 2段目: 1週間ずつ前後に移動するボタン（読み込み中は押せない） */}
          <div className={styles["select-row"]}>
            {/* 前週へ移動 */}
            <button 
              type="button"
              onClick={() => handleWeekJump('B')}
              disabled={loading}
              className="orange_button"
            >
              前週
            </button>
            {/* 次週へ移動 */}
            <button 
              type="button"
              onClick={() => handleWeekJump('A')}
              disabled={loading}
              className="orange_button"
            >
              次週
            </button>
          </div>
        </div>
        {/* 表の外枠: 高さはウィンドウの高さまで（超えたら縦スクロール）、幅は表の幅に20pxを足した幅 */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            width: `${tableWidth + 20}px`,
          }}
        >
          {/* 班員×曜日の入力状況表（幅を測るため ref を付ける） */}
          <table ref={tableRef}>
            <thead>
              {/* 見出し1行目: 曜日（日曜はピンク・土曜は青・平日は薄いオレンジの背景） */}
              <tr>
                <th colSpan={2} className={styles["th-collar1"]}>曜日</th>
                <th className={styles["th-collar3"]}>日</th>
                <th className={styles["th-collar1"]}>月</th>
                <th className={styles["th-collar1"]}>火</th>
                <th className={styles["th-collar1"]}>水</th>
                <th className={styles["th-collar1"]}>木</th>
                <th className={styles["th-collar1"]}>金</th>
                <th className={styles["th-collar2"]}>土</th>
              </tr>
              {/* 見出し2行目: 表示週の日付（MM/DD） */}
              <tr>
                <th colSpan={2} className={styles["th-collar1"]}>日付</th>
                {searchDays.map((date, index) => {
                  // 0番目（日曜）はピンク、6番目（土曜）は青、それ以外は平日の色にする
                  const className = index === 0 
                    ? styles["th-collar3"] 
                    : index === 6 
                    ? styles["th-collar2"] 
                    : styles["th-collar1"];
                  // 日付の見出しセル（key には曜日の位置を使う）
                  return (
                    <th key={index} className={className}>
                      {displayDate(date)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {/* 表の本体: 班員1人につき3行（勤務・残業・入力時間）を表示（key には従業員番号を使う） */}
            <tbody>
              {memberNames.map(([employeeNo, name], memberIndex) => (
                <React.Fragment key={employeeNo}>
                  {/* 1行目: 勤務（就業形態）。工数入力OKの日は緑色 */}
                  <tr>
                    {/* 氏名のセル（3行分を縦に結合する） */}
                    <td rowSpan={3}>
                      {name}
                    </td>
                    <td>勤務</td>
                    {searchDays.map((date, dayIndex) => {
                      // この班員・この日の工数データを対応表から取り出す（なければ空欄）
                      const kosuKey = `${employeeNo}_${date}`;
                      const kosuEntry = kosuMap[kosuKey];
                      const workTime = kosuEntry ? kosuEntry.work_time : '';
                      // 工数入力OK判定の日は背景を緑色（#ADFF2F）にする
                      return (
                        <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                          {workTime}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 2行目: 残業時間（分）。工数入力OKの日は緑色 */}
                  <tr>
                    <td>残業(分)</td>
                    {searchDays.map((date, dayIndex) => {
                      // この班員・この日の工数データを対応表から取り出す（なければ空欄）
                      const kosuKey = `${employeeNo}_${date}`;
                      const kosuEntry = kosuMap[kosuKey];
                      const overTime = kosuEntry ? kosuEntry.over_time : '';
                      // 工数入力OK判定の日は背景を緑色（#ADFF2F）にする
                      return (
                        <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                          {overTime}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 3行目: 入力時間（作業をしている時間帯）。クリックで詳細画面へ */}
                  <tr>
                    <td>入力時間</td>
                    {searchDays.map((date, dayIndex) => {
                      // この班員・この日の工数データを対応表から取り出す
                      const kosuKey = `${employeeNo}_${date}`;
                      const kosuEntry = kosuMap[kosuKey];
                      /** セルのクリック時: 工数データがある場合だけ班員工数履歴詳細画面へ遷移する */
                      const handleCellClick = () => {
                        if (kosuEntry && kosuEntry.id) {
                          navigate(`/team-detail/${kosuEntry.id}`);
                        }
                      };
                      // 工数データがあれば作業内容から時間帯を作り、なければ空の4行を作る
                      const timeWorkContent = kosuEntry && kosuEntry.time_work
                        ? formatTimeWork(kosuEntry.time_work)
                        : formatTimeWork('');

                      // 工数入力OK判定の日は緑色、工数データがあるセルはマウスカーソルを指の形にする
                      return (
                        <td 
                          key={dayIndex} 
                          className={styles["time-work-cell"]} 
                          style={{ 
                            backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '',
                            cursor: kosuEntry?.id ? 'pointer' : 'default',
                          }}
                          onClick={handleCellClick}
                        >
                          {timeWorkContent}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default TeamCalendar;