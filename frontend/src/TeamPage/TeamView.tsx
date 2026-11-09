/**
 * ============================================================
 * ファイル名 : TeamView.tsx
 * 種別       : 画面コンポーネント（ショップ単位工数入力状況画面）
 * 概要       : 選択したショップに所属する人員全員の工数入力状況（OK/NG）を、
 *              選択した年月の1か月分（1日〜月末）の表で表示する画面。
 *              班員登録に関係なくショップ単位で確認でき、Excelファイルにも出力できる。
 *
 * 主な機能   :
 *   - 年・月のプルダウンで表示する月を切り替え
 *   - ショップのプルダウンで表示するショップを切り替え（初期値はログイン者のショップ）
 *     （表示年月・ショップはサーバー側のセッションに保存される。
 *       年月のセッション値は班員残業画面（TeamOverTime.tsx）と共通）
 *   - 人員ごと・日ごとの工数入力OK/NG判定の表示（OKの日は緑色。工数データがない日もNG）
 *     ※管理者設定の問い合わせ担当者に登録された人員はサーバー側で表から除外される
 *   - 「Excelに出力」で、選択中のショップ・年月の工数入力状況をExcelファイルでダウンロード
 *
 * 使用API    : GET  /api/team_view/         表示月・ショップの工数データ取得（kosu/views/team_views.py の TeamView）
 *              POST /api/team_view/         表示年月をセッションに保存（同上）
 *              POST /api/team_shop_select/  表示ショップをセッションに保存（kosu/views/team_views.py の TeamShopSelect）
 *              POST /api/team_export/       工数入力状況のExcelファイル作成（kosu/views/team_views.py の TeamExport）
 * 画面URL    : /team-view                   （index.tsx のルーティング定義）
 * 関連ファイル: styles/TeamPage/TeamView.module.css, Components/ShopSelect.tsx, Components/Loading.tsx,
 *              kosu/utils/team_utils.py（Excelの各シートの作成処理 excel_function）
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
import ShopSelect from "../Components/ShopSelect"; // ショップを選ぶプルダウン
import styles from "../styles/TeamPage/TeamView.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数データ1件分（GET /api/team_view/ のレスポンス kosu_data の要素。一部の項目のみ定義） */
interface Kosu {
  id: number; // 工数データのID（主キー）
  employee_no3: number; // 従業員番号
  name: string; // 氏名（サーバーからは人員データのIDが届く。この画面では使用していない）
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（この画面では使用していない）
  work_time: string; // 就業形態（この画面では使用していない）
  time_work: string; // 作業内容（この画面では使用していない）
  judgement: boolean; // 工数入力OK/NG判定（true なら "OK" を表示し緑色で塗る）
  over_time: string; // 残業時間（この画面では使用していない）
}

/** 「従業員番号_就業日」（例: "12345_2026-11-09"）をキーに工数データを引ける対応表 */
type KosuMap = {
  [key: string]: Kosu;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ショップ単位工数入力状況画面。
 *
 * 表示時にサーバーのセッションに保存された年月・ショップ（なければ今月・ログイン者のショップ）の
 * 工数データを取得し、人員×日付のOK/NG表を表示する。
 *
 * @returns ショップ単位工数入力状況画面のJSX
 */
const TeamView: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Kosu[]>([]); // 取得した表示月の工数データ（表の幅の再計算のきっかけに使う）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大の高さ（ウィンドウの高さに合わせる）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の実際の幅（外枠の幅を合わせるのに使う）
  const [memberNames, setMemberNames] = useState<[number, string][]>([]); // 表示ショップの人員一覧（[従業員番号, 氏名] の配列）
  const [kosuMap, setKosuMap] = useState<KosuMap>({}); // 「従業員番号_就業日」から工数データを引く対応表
  const [sessionYear, setSessionYear] = useState<number | null>(null); // 表示中の年（サーバーのセッション値。取得前は null）
  const [sessionMonth, setSessionMonth] = useState<number | null>(null); // 表示中の月（1〜12。取得前は null）
  const [shopDefault, setshopDefault] = useState<string | null>(null); // 表示中のショップ（サーバーのセッション値）
  // 表のDOM要素への参照（実際の幅を測るために使う）
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- データ取得 ----------

  /**
   * 表示月・表示ショップの工数データをサーバーから取得し、表の表示用に state へ保存する。
   *
   * サーバーはセッションに保存された年月（なければ今日の年月）とショップ（なければログイン者のショップ）で
   * データを絞り込んで返す。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
   * useEffect や他の関数の依存配列に入れるため、useCallback で関数を使い回す。
   *
   * @returns なし（結果は memberNames / sessionYear / sessionMonth / shopDefault / kosuMap / data / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/team_view/ : 以下を取得
      //   session_year / session_month: 表示する年・月
      //   shop_default                : 表示するショップ
      //   kosu_data                   : 表示月・ショップの人員の工数データ一覧
      //   member_name_list            : 表示ショップの人員の [従業員番号, 氏名] の一覧（問い合わせ担当者を除く）
      const response = await api.get("/api/team_view/");
      const results = response.data.kosu_data || [];
      const memberNameList: [number, string][] = response.data.member_name_list || [];
      setMemberNames(memberNameList);

      // 年・月が数値で返ってきた場合だけ表示年月として保存し、ショップはそのまま保存する
      const year = response.data.session_year;
      const month = response.data.session_month;
      const shop = response.data.shop_default;
      if (typeof year === 'number' && typeof month === 'number') {
        setSessionYear(year);
        setSessionMonth(month);
      }
      setshopDefault(shop);

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
      // POST /api/team_view/ : 表示年月をセッションに保存（班員残業画面と同じセッション値）
      await api.post("/api/team_view/", {
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

  /**
   * 表示ショップをサーバーのセッションに保存し、そのショップのデータを取得し直す。
   *
   * handleShopChange から呼ばれる。fetchData は await せずに呼び出している。
   *
   * @param shopValue - 表示するショップ（例: "W1"）
   * @returns なし
   */
  const postShopSelect = useCallback(async (shopValue: string) => {
    setLoading(true);
    try {
      // POST /api/team_shop_select/ : 表示ショップをセッションに保存
      await api.post("/api/team_shop_select/", { shop_default: shopValue });
      // 保存したショップのデータを取得し直す
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

  // ---------- イベントハンドラ ----------

  /**
   * ショップのプルダウンが変更されたときの処理。
   *
   * 画面上の選択値をすぐに切り替えてから、サーバーへ保存してデータを取得し直す。
   * useCallback で関数を使い回す（postShopSelect が変わったときだけ作り直す）。
   *
   * @param e - プルダウンの変更イベント（value: 選ばれたショップ）
   * @returns なし
   */
  const handleShopChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const shop = e.target.value;
    setshopDefault(shop);
    postShopSelect(shop);
  }, [postShopSelect]);


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
   * @returns 土曜: th-collar2 / 日曜: th-collar3 / 平日: th-collar1（色は TeamView.module.css で定義）
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

  // ---------- イベントハンドラ（年月の変更・Excel出力） ----------

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

  /**
   * 「Excelに出力」ボタン押下時の処理。
   *
   * 処理の流れ:
   *   1. 年・月・ショップが揃っていなければ警告を出して終了
   *   2. サーバーにExcelファイルを作成してもらい、ファイルの中身（バイナリ）を受け取る
   *   3. 受け取った中身からブラウザ内に一時的なURLを作り、見えないリンクをクリックしてダウンロードさせる
   * Excelはショップの人員1人につき1シート（シート名は氏名）で、その月の日ごとの勤務状況が書き込まれる。
   *
   * @returns なし
   */
  const handleExport = async () => {
    // 1. 出力条件が揃っていない場合は中止する
    if (!sessionYear || !sessionMonth || !shopDefault) {
      alert("年、月、およびショップを選択してください。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 2. POST /api/team_export/ : 指定年月・ショップの工数入力状況をExcelファイルにしてもらう
      //   year / month: 出力する年・月
      //   shop2       : 出力するショップ
      //   responseType: 'blob' … 応答をJSONではなくファイルの中身（バイナリデータ）として受け取る指定
      const response = await api.post("/api/team_export/",
        { 
          year: sessionYear, 
          month: sessionMonth,
          shop2: shopDefault 
        },
        {
          responseType: 'blob'
        }
      );

      // 受け取ったデータを Excel（.xlsx）形式のファイルデータとして扱う
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // 3. ファイルデータを指す一時的なURLを作り、それを開くリンク（<a>要素）を作る
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // ダウンロード時のファイル名（例: "2026年11月度_工数入力状況_W1.xlsx"）
      const filename = `${sessionYear}年${sessionMonth}月度_工数入力状況_${shopDefault}.xlsx`;
      link.setAttribute('download', filename);
      
      // リンクを一時的に画面へ追加してクリックし（ダウンロード開始）、終わったらリンクとURLを片付ける
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        // （responseType が 'blob' のため、応答本文は JSON ではなく Blob として届く点に注意）
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
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
      <div className={styles["team-view-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数入力状況(全体)</h1>
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
        {/* 表示ショップの選択欄: 変更すると handleShopChange でセッションに保存して再取得する */}
        <div className={styles["shop-select-container"]}>
          <ShopSelect
            id="shop-select-1"
            name="shop1"
            value={shopDefault || ""}
            onChange={handleShopChange}
          />
        </div>
        {/* Excel出力ボタン（読み込み中は押せない） */}
        <div className={styles["select-row"]}>
          <button 
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="orange_button"
          >
          Excelに出力
          </button>
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
          {/* 人員×日付の工数入力OK/NG表（幅を測るため ref を付ける） */}
          <table ref={tableRef}>
            <thead>
              {/* 見出し1行目: 氏名（2行分を縦に結合）・日（1〜月末） */}
              <tr>
                <th rowSpan={2} className={styles["th-collar1"]}>氏名</th>
                {/* 日付の見出し（土曜・日曜・平日で背景色を変える。key には日付の位置を使う） */}
                {datesAndWeekdays.map((item, index) => (
                  <th 
                    key={`day-${index}`} 
                    className={getThCollarClass(item.weekday)}
                  >
                    {item.day}
                  </th>
                ))}
              </tr>
              {/* 見出し2行目: 曜日 */}
              <tr>
                {datesAndWeekdays.map((item, index) => {
                  // 曜日の見出しセル（key には日付の位置を使う）
                  return (
                    <th 
                      key={`weekday-${index}`} 
                      className={getThCollarClass(item.weekday)}
                    >
                      {item.weekday}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {/* 表の本体: 人員1人につき1行を表示（key には従業員番号を使う） */}
            <tbody>
              {memberNames.map(([employeeNo, name], memberIndex) => {
                return (
                  <React.Fragment key={employeeNo}>
                    <tr>
                      {/* 人員の氏名 */}
                      <td>
                        {name}
                      </td>
                      {/* 日ごとの工数入力OK/NGのセル */}
                      {datesAndWeekdays.map((dateItem, dayIndex) => {
                        // この人員・この日の工数データを対応表から取り出す
                        const kosuKey = `${employeeNo}_${dateItem.fullDate}`; 
                        const kosuEntry = kosuMap[kosuKey];
                        // 工数入力OK判定なら緑色で "OK"、NG判定または工数データがない日は "NG" を表示する
                        return (
                          <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                            {kosuEntry ? (kosuEntry.judgement ? "OK" : "NG") : "NG"}
                          </td>
                        );
                      })}
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
export default TeamView;