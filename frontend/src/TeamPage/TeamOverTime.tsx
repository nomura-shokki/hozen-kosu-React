/**
 * ============================================================
 * ファイル名 : TeamOverTime.tsx
 * 種別       : 画面コンポーネント（班員残業画面）
 * 概要       : ログイン者が登録した班員の残業時間を、選択した年月の1か月分（1日〜月末）の表で表示する画面。
 *              班員ごとに1行、日付ごとに1列で残業時間（時間単位・小数2桁）を並べ、右端に月の合計を表示する。
 *
 * 主な機能   :
 *   - 年・月のプルダウンで表示する月を切り替え
 *     （表示年月はサーバー側のセッションに保存されるため、画面を開き直しても同じ月が表示される）
 *   - 班員ごとの日別残業時間と月合計の表示（工数入力OK判定の日は緑色）
 *   - 班員が未登録の場合は班員メニュー画面へ戻してメッセージを表示
 *
 * 使用API    : GET  /api/team_overtime/  表示月の班員工数データ取得（kosu/views/team_views.py の TeamOverTime）
 *              POST /api/team_overtime/  表示年月をセッションに保存（同上）
 * 画面URL    : /team-overtime            （index.tsx のルーティング定義）
 * 関連ファイル: styles/TeamPage/TeamOverTime.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/TeamPage/TeamOverTime.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数データ1件分（GET /api/team_overtime/ のレスポンス kosu_data の要素。一部の項目のみ定義） */
interface Kosu {
  id: number; // 工数データのID（主キー）
  employee_no3: number; // 従業員番号
  name: string; // 氏名（サーバーからは人員データのIDが届く。この画面では使用していない）
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（この画面では使用していない）
  work_time: string; // 就業形態（この画面では使用していない）
  time_work: string; // 作業内容（この画面では使用していない）
  judgement: boolean; // 工数入力OK/NG判定（true のセルを緑色で塗る）
  over_time: string; // 残業時間（分）。表示時に60で割って時間に換算する
}

/** 「従業員番号_就業日」（例: "12345_2026-11-09"）をキーに工数データを引ける対応表 */
type KosuMap = {
  [key: string]: Kosu;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 班員残業画面。
 *
 * 表示時にサーバーのセッションに保存された年月（なければ今月）の班員工数データを取得し、
 * 班員×日付の残業時間表を表示する。
 *
 * @returns 班員残業画面のJSX
 */
const TeamOverTime: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Kosu[]>([]); // 取得した表示月の工数データ（表の幅の再計算のきっかけに使う）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大の高さ（ウィンドウの高さに合わせる）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の実際の幅（外枠の幅を合わせるのに使う）
  const [memberNames, setMemberNames] = useState<[number, string][]>([]); // 班員の一覧（[従業員番号, 氏名] の配列）
  const [kosuMap, setKosuMap] = useState<KosuMap>({}); // 「従業員番号_就業日」から工数データを引く対応表
  const [sessionYear, setSessionYear] = useState<number | null>(null); // 表示中の年（サーバーのセッション値。取得前は null）
  const [sessionMonth, setSessionMonth] = useState<number | null>(null); // 表示中の月（1〜12。取得前は null）
  // 表のDOM要素への参照（実際の幅を測るために使う）
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- データ取得 ----------

  /**
   * 表示月の班員工数データをサーバーから取得し、表の表示用に state へ保存する。
   *
   * サーバーはセッションに保存された年月（なければ今日の年月）のデータを返す。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ、
   * 400（班員未登録）なら班員メニューへメッセージ付きで遷移する。
   * useEffect と postYearMonth の依存配列に入れるため、useCallback で関数を使い回す。
   *
   * @returns なし（結果は memberNames / sessionYear / sessionMonth / kosuMap / data / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/team_overtime/ : 以下を取得
      //   session_year / session_month: 表示する年・月
      //   kosu_data                   : 表示月の班員の工数データ一覧
      //   member_name_list            : 班員の [従業員番号, 氏名] の一覧
      const response = await api.get("/api/team_overtime/");
      const results = response.data.kosu_data || [];
      const memberNameList: [number, string][] = response.data.member_name_list || [];
      setMemberNames(memberNameList);

      // 年・月が数値で返ってきた場合だけ、表示年月として保存する
      const year = response.data.session_year;
      const month = response.data.session_month;
      if (typeof year === 'number' && typeof month === 'number') {
        setSessionYear(year);
        setSessionMonth(month);
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

  /**
   * 表示年月をサーバーのセッションに保存し、その月のデータを取得し直す。
   *
   * handleYearMonthChange から呼ばれる。fetchData は await せずに呼び出している。
   *
   * @param year  - 表示する年（例: 2026）
   * @param month - 表示する月（1〜12）
   * @returns なし
   */
  const postYearMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      // POST /api/team_overtime/ : 表示年月をセッションに保存
      await api.post("/api/team_overtime/", {
        year: year,
        month: month,
      });
      // 保存した年月のデータを取得し直す
      fetchData();
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
  }, [fetchData, navigate]);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（fetchData は navigate が変わらない限り同じ関数のため実質1回）: 表示月のデータを取得する
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 初回表示時のみ（依存配列が空）: ウィンドウサイズの変更を監視し、表の外枠の最大の高さを合わせる
  useEffect(() => {
    /** 表の外枠の最大の高さを現在のウィンドウの高さにする */
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight);
    };
    // まず現在の高さで1回設定し、ウィンドウサイズが変わるたびに設定し直す
    updateMaxHeight();
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
   * 指定した年月の1日〜月末までの日付と曜日の一覧を作る（表の見出し用）。
   *
   * @param year  - 年（例: 2026）
   * @param month - 月（1〜12）
   * @returns 日ごとの { day: 日（1〜31）, weekday: 曜日（"日"〜"土"）, fullDate: "YYYY-MM-DD" } の配列
   */
  const generateDatesAndWeekdays = (year: number, month: number) => {
    const dateList: { day: number, weekday: string, fullDate: string }[] = [];
    // 月末日を求める: Date の月は0始まりのため new Date(year, month, 0) は「翌月の0日」＝「その月の末日」になる
    // （例: 2026年2月 → new Date(2026, 2, 0) → 2026-02-28 → 28日）
    const daysInMonth = new Date(year, month, 0).getDate();
    // Date.getDay() の戻り値（0=日曜〜6=土曜）の順に並べた曜日表
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    // 1日から月末まで1日ずつ日付・曜日・"YYYY-MM-DD" 形式の文字列を作る
    for (let day = 1; day <= daysInMonth; day++) {
      // Date の月は0始まりのため month - 1 を渡す
      const date = new Date(year, month - 1, day);
      const weekday = weekdays[date.getDay()];
      // 対応表のキーと合わせるため、月・日は2桁にそろえて "YYYY-MM-DD" にする
      const fullDate = [
        year,
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0'),
      ].join('-');

      dateList.push({ day, weekday, fullDate });
    }
    return dateList;
  };

  // 表示月の日付・曜日の一覧（年月の取得前は空配列）
  const datesAndWeekdays = (sessionYear && sessionMonth) ? generateDatesAndWeekdays(sessionYear, sessionMonth) : [];

  /**
   * 曜日に応じた見出しセルのCSSクラスを返す。
   *
   * @param weekday - 曜日（"日"〜"土"）
   * @returns 土曜: th-collar2（青）/ 日曜: th-collar3（ピンク）/ 平日: th-collar1（薄いオレンジ）
   */
  const getThCollarClass = (weekday: string) => {
    if (weekday === "土") {
      return styles["th-collar2"];
    }
    if (weekday === "日") {
      return styles["th-collar3"];
    }
    return styles["th-collar1"];
  };

  // ---------- イベントハンドラ ----------

  /**
   * 年・月のプルダウンが変更されたときの処理。
   *
   * 変更された方（年 or 月）の新しい値と、もう一方の現在の値を組み合わせて表示年月を保存する。
   *
   * @param e - プルダウンの変更イベント（name: "year" または "month" / value: 選択値）
   * @returns なし
   */
  const handleYearMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    // 年が変更された: 新しい年 ＋ 現在の月
    if (name === "year" && sessionMonth !== null) {
      postYearMonth(Number(value), sessionMonth);
    // 月が変更された: 現在の年 ＋ 新しい月
    } else if (name === "month" && sessionYear !== null) {
      postYearMonth(sessionYear, Number(value));
    }
  };

  /**
   * 年プルダウンの選択肢（今年の5年前〜5年後の11年分）を作る。
   *
   * @returns 年の配列（例: 今年が2026年なら 2021〜2031）
   */
  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      {/* ローディング表示（この位置では loading は常に false のため、フェードアウトして消える） */}
      <Loading isLoading={loading} />
      <div className={styles["team-overtime-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>班員工数入力状況</h1>
        {/* 班員メニュー画面へ戻るリンク */}
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>
        {/* 表示年月の選択欄: 変更すると handleYearMonthChange でセッションに保存して再取得する */}
        <div className={styles["year-month-selector"]}>
          {/* 年のプルダウン（今年の前後5年） */}
          <select
            name="year"
            value={sessionYear || ""}
            onChange={handleYearMonthChange}
          >
            {getYears().map(year => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
          {/* 月のプルダウン（1〜12月。長さ12の配列を作り、位置 i に +1 して月にする） */}
          <select
            name="month"
            value={sessionMonth || ""}
            onChange={handleYearMonthChange}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}月
              </option>
            ))}
          </select>
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
          {/* 班員×日付の残業時間表（幅を測るため ref を付ける） */}
          <table ref={tableRef}>
            <thead>
              {/* 見出し1行目: 氏名・日（1〜月末）・合計。氏名と合計は2行分を縦に結合する */}
              <tr>
                <th rowSpan={2} className={styles["th-collar1"]}>氏名</th>
                {/* 日付の見出し（土曜は青・日曜はピンク・平日は薄いオレンジの背景） */}
                {datesAndWeekdays.map((item, index) => (
                  <th 
                    key={`day-${index}`} 
                    className={getThCollarClass(item.weekday)} // 曜日に応じて見出しの背景色を変える
                  >
                    {item.day}
                  </th>
                ))}
                <th rowSpan={2} className={styles["th-collar1"]}>合計</th>
              </tr>
              {/* 見出し2行目: 曜日 */}
              <tr>
                {datesAndWeekdays.map((item, index) => {
                  // 曜日の見出しセル（key には日付の位置を使う）
                  return (
                    <th 
                      key={`weekday-${index}`} 
                      className={getThCollarClass(item.weekday)} // 曜日に応じて見出しの背景色を変える
                    >
                      {item.weekday}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {/* 表の本体: 班員1人につき1行を表示（key には従業員番号を使う） */}
            <tbody>
              {memberNames.map(([employeeNo, name], memberIndex) => {
                // この班員の月合計の残業時間（分）。日付ごとのセルを作りながら足し込む
                let totalOverTimeMinutes = 0;
                return (
                  <React.Fragment key={employeeNo}>
                    <tr>
                      {/* 班員の氏名 */}
                      <td>
                        {name}
                      </td>
                      {/* 日ごとの残業時間のセル */}
                      {datesAndWeekdays.map((dateItem, dayIndex) => {
                        // この班員・この日の工数データを対応表から取り出す
                        const kosuKey = `${employeeNo}_${dateItem.fullDate}`; 
                        const kosuEntry = kosuMap[kosuKey];
                        // 残業時間（分）。工数データがない・数値でない場合は0分として扱う
                        const overTimeMinutes = kosuEntry && !isNaN(Number(kosuEntry.over_time)) ? Number(kosuEntry.over_time) : 0;
                        // 月合計に足し込む
                        totalOverTimeMinutes += overTimeMinutes;
                        // 分を時間に換算して小数2桁で表示する（例: 90分 → "1.50"）。0以下は "0.00"
                        const overTimeDisplay = overTimeMinutes > 0 ? (overTimeMinutes / 60).toFixed(2) : "0.00";

                        // 工数入力OK判定の日は背景を緑色（#ADFF2F）にする
                        return (
                          <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                            {overTimeDisplay}
                          </td>
                        );
                      })}
                      {/* 月合計の残業時間: 分を時間に換算して小数2桁＋"H" で表示（例: 600分 → 10.00H） */}
                      <td className={styles["th-total"]}>
                        {
                          totalOverTimeMinutes > 0
                            ? (totalOverTimeMinutes / 60).toFixed(2)
                            : "0.00"
                        }H
                      </td>
                    </tr>
                  </React.Fragment>
              )})}
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
export default TeamOverTime;