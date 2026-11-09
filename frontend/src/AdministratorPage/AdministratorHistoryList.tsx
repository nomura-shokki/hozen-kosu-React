/**
 * ============================================================
 * ファイル名 : AdministratorHistoryList.tsx
 * 種別       : 画面コンポーネント（データ操作履歴一覧画面）
 * 概要       : 操作履歴（データ変更の監査ログ）を操作日時の新しい順に一覧表示する管理者向け画面。
 *              操作日（指定日 / 指定月）・レコードID・テーブル名・操作者の従業員番号で絞り込みができる。
 *
 * 主な機能   :
 *   - 操作履歴データ一覧の取得と表示（ページネーション付き）
 *   - 日付での絞り込み（「指定月検索」「指定日検索」ボタン）
 *   - レコードID・操作テーブル・操作者従業員番号での絞り込み（「検索」ボタン）
 *   - 検索条件とページ番号をURLのクエリ文字列に保存（詳細画面から戻っても条件が残る）
 *   - 操作者の従業員番号から氏名を引いて表示
 *   - 各行の「詳細」リンクからデータ操作履歴詳細画面へ遷移
 *
 * 使用API    : GET /api/manager_history/  操作履歴一覧取得（kosu/views/main_views.py の AdministratorHistoryList）
 * 画面URL    : /manager-history            （index.tsx のルーティング定義）
 *              例: /manager-history?day=2026-11-09&id=&no=&table=member&page=2
 * 関連ファイル: styles/AdministratorPage/AdministratorHistoryList.module.css,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx,
 *              AdministratorPage/AdministratorHistoryDetail.tsx（詳細画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/AdministratorPage/AdministratorHistoryList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 操作履歴一覧の1行分のデータ（GET /api/manager_history/ のレスポンス history_data.results の要素） */
interface History {
  id: number; // 操作履歴データのID（主キー）。詳細画面のURLに使う
  operation: string;   // 操作種別（"CREATE"=新規作成 / "UPDATE"=更新 / "DELETE"=削除）
  table_name: string;  // 変更されたテーブル名（"member" / "Business_Time_graph"）
  record_id: string;   // 変更されたレコードのID
  login_No: string;    // 操作者の従業員番号（ログイン中の人員）
  timestamp: string;     // 操作日時（ISO形式の日時文字列）
  operator_name?: string; // 操作者の氏名（画面側で login_No から引いて追加する項目）
}

/** 人員データ（GET /api/manager_history/ のレスポンス member_select の要素。操作者の氏名表示に使う） */
interface Member {
  id: number; // 人員データのID（主キー）
  employee_no: number; // 従業員番号
  name: string; // 氏名
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * サーバーから受け取った日時文字列を画面表示用の形式に変換する。
 *
 * ブラウザのタイムゾーン（日本なら日本時間）に変換したうえで
 * "YYYY-MM-DD (HH:MM)" の形にする（例: "2026-11-09T01:30:00Z" → "2026-11-09 (10:30)"）。
 *
 * @param timestamp - 日時文字列（ISO形式）
 * @returns 表示用の日時文字列。空なら空文字、日時として解釈できない場合は元の文字列のまま
 */
const formatTimestamp = (timestamp: string): string => {
  // 値がない場合は何も表示しない
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    // 日時として解釈できない（Invalid Date）場合は、元の文字列をそのまま表示する
    if (isNaN(date.getTime())) return timestamp;
    // 年・月・日・時・分を取り出す。月は 0 始まり（0=1月）のため +1 し、
    // padStart で2桁に0埋めする（例: 3 → "03"）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} (${hours}:${minutes})`;
  } catch (error) {
    // 想定外の例外が起きても画面を止めないよう、元の文字列を返す
    console.error("Failed to format timestamp:", error);
    return timestamp;
  }
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * データ操作履歴一覧画面。
 *
 * 入力欄の値（searchXxx）と、実際にAPIへ送る確定済みの条件（currentFilterXxx）を分けて持ち、
 * 検索ボタンが押されたときだけ確定済みの条件を更新して一覧を取得し直す。
 * 確定済みの条件とページ番号はURLのクエリ文字列にも保存し、画面を開き直したときに復元する。
 *
 * @returns データ操作履歴一覧画面のJSX
 */
const AdministratorHistoryList: React.FC = () => {
  // ---------- フック初期化 ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  // URLのクエリ文字列（?day=...&page=... の部分）の読み取りと書き換えに使う
  const [searchParams, setSearchParams] = useSearchParams();
  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<History[]>([]); // 表に表示する操作履歴データ（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）

  // 検索欄に入力中の値（初期値はURLのクエリ文字列。なければ空文字）
  const [searchDay, setSearchDay] = useState<string>(searchParams.get("day") || ""); // 操作日（"YYYY-MM-DD"）
  const [searchId, setSearchId] = useState<string>(searchParams.get("id") || ""); // レコードID
  const [searchNo, setSearchNo] = useState<string>(searchParams.get("no") || ""); // 操作者の従業員番号
  const [searchTable, setSearchTable] = useState<string>(searchParams.get("table") || ""); // 操作テーブル名

  // APIに送る確定済みの絞り込み条件（検索ボタン押下時に入力中の値から更新する）
  const [currentFilterDay, setCurrentFilterDay] = useState<string>(searchParams.get("day") || ""); // 操作日
  const [currentFilterId, setCurrentFilterId] = useState<string>(searchParams.get("id") || ""); // レコードID
  const [currentFilterNo, setCurrentFilterNo] = useState<string>(searchParams.get("no") || ""); // 操作者の従業員番号
  const [currentFilterTable, setCurrentFilterTable] = useState<string>(searchParams.get("table") || ""); // 操作テーブル名
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false); // true: 月単位で検索 / false: 日単位で検索

  // ページネーション管理（ページ番号の初期値はURLの page。数値にできなければ1ページ目）
  const [currentPage, setCurrentPage] = useState<number>(Number(searchParams.get("page")) || 1); // 現在のページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数

  // 操作テーブルの選択肢（サーバーから受け取ったモデル名の一覧）
  const [modelChoices, setModelChoices] = useState<string[]>([]);

  // ---------- データ取得 ----------

  /**
   * 操作履歴データ一覧をサーバーから取得し、state に保存する。
   *
   * あわせてテーブル名の選択肢と人員一覧を受け取り、操作者の従業員番号から氏名を引いて各行に付け足す。
   * 401（未ログイン）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
   * useEffect の依存配列に入れるため、useCallback で関数を使い回す（毎回作り直さない）。
   *
   * @param page    - 取得するページ番号（1始まり）
   * @param day     - 操作日（"YYYY-MM-DD"）。空文字なら絞り込みなし
   * @param mode    - true: 月単位で検索 / false: 日単位で検索
   * @param id      - レコードID（部分一致）。空文字なら絞り込みなし
   * @param table   - 操作テーブル名（完全一致）。空文字なら絞り込みなし
   * @param loginNo - 操作者の従業員番号（部分一致）。空文字なら絞り込みなし
   * @returns なし（結果は data / totalPages / modelChoices / error の state に反映）
   */
  const fetchData = useCallback(async (
    page: number,
    day: string,
    mode: boolean,
    id: string,
    table: string,
    loginNo: string,
  ) => {
    setLoading(true);
    try {
      // GET /api/manager_history/ : 操作履歴一覧を取得（空文字の条件はサーバー側で無視される）
      //   record_id : レコードIDの部分一致
      //   day / mode: 操作日での絞り込み（"month"=同じ年月すべて / "day"=その日のみ）
      //   table_name: テーブル名の完全一致
      //   login_No  : 操作者の従業員番号の部分一致
      const response = await api.get("/api/manager_history/", {
        params: {
          page: page,
          record_id: id,
          day: day,
          mode: mode ? "month" : "day",
          table_name: table,
          login_No: loginNo,
        }
      });

      const historyData = response.data?.history_data || {}; // 操作履歴（count / page_size / results）
      const ModelChoices = response.data?.model_choices || {}; // テーブル名一覧（History 以外のモデル名）

      // テーブル名一覧が配列で届いた場合だけ選択肢として保存する
      if (Array.isArray(ModelChoices)) setModelChoices(ModelChoices);

      // results: 現在ページのデータ / page_size: 1ページの件数（管理者設定の一覧表示項目数）
      const results = historyData.results || [];
      const pageSize = historyData.page_size || 20;
      // 従業員番号 → 氏名 の対応表を作る（例: { 12345: "山田太郎" }）
      const memberOptions = response.data?.member_select || [];
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: Member) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 各行に操作者の氏名（operator_name）を付け足す。
      // 人員データに見つからない場合は "Unknown (従業員番号)" と表示する
      const transformedData = results.map((item: History) => ({
        ...item,
        operator_name: memberNameMap[Number(item.login_No)] || `Unknown (${item.login_No})`,
      }));

      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(historyData.count / pageSize));
      setData(transformedData);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
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

  // ---------- 副作用（useEffect） ----------

  // ページ番号・確定済みの絞り込み条件・検索モードのいずれかが変わったとき:
  // その条件で一覧を取得し直す（初回表示時も実行される）
  useEffect(() => {
    fetchData(currentPage, currentFilterDay, searchByMonth, currentFilterId, currentFilterTable, currentFilterNo);
  }, [currentPage, fetchData, currentFilterDay, currentFilterId, currentFilterNo, currentFilterTable, searchByMonth]);

  // ---------- イベントハンドラ ----------

  /**
   * 「指定月検索」「指定日検索」ボタン押下時の処理。
   *
   * 入力中の日付だけを確定済みの条件に反映し（他の条件は確定済みの値のまま）、
   * 1ページ目に戻してURLのクエリ文字列も更新する。一覧の再取得は useEffect が行う。
   *
   * @param isMonthSearch - true: 指定月で検索 / false: 指定日で検索
   * @returns なし
   */
  const handleDaySearchClick = (isMonthSearch: boolean) => {
    setCurrentFilterDay(searchDay); // 入力中の日付を確定済みの条件にする
    setSearchByMonth(isMonthSearch); // 検索モード（月/日）を更新
    setCurrentPage(1); // 検索時は1ページ目へ
    // URLのクエリ文字列を更新（日付以外は確定済みの条件を使う）
    setSearchParams({
      day: searchDay,
      id: currentFilterId,
      no: currentFilterNo,
      table: currentFilterTable,
      page: "1",
    });
  };

  /**
   * 「検索」ボタン押下時の処理。
   *
   * 入力中のすべての条件（日付・レコードID・従業員番号・テーブル名）を確定済みの条件に反映し、
   * 1ページ目に戻してURLのクエリ文字列も更新する。一覧の再取得は useEffect が行う。
   *
   * @returns なし
   */
  const handleIDAndTableSearchClick = () => {
    // 入力中の値をすべて確定済みの条件にする
    setCurrentFilterDay(searchDay);
    setCurrentFilterId(searchId);
    setCurrentFilterNo(searchNo);
    setCurrentFilterTable(searchTable);
    // 検索時は1ページ目へ
    setCurrentPage(1);
    // URLのクエリ文字列を入力中の値で更新
    setSearchParams({
      day: searchDay,
      id: searchId,
      no: searchNo,
      table: searchTable,
      page: "1",
    });
  };

  /**
   * ページ切り替え時の処理（Pagination から呼ばれる）。
   *
   * ページ番号を更新し、URLのクエリ文字列の page も合わせて書き換える。
   *
   * @param page - 移動先のページ番号（1始まり）
   * @returns なし
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 確定済みの条件はそのままに、ページ番号だけ変えてURLに保存する
    setSearchParams({
      day: currentFilterDay,
      id: currentFilterId,
      no: currentFilterNo,
      table: currentFilterTable,
      page: String(page),
    });
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      {/* 読み込み中表示（この時点では loading は false のため表示されない） */}
      <Loading isLoading={loading} />
      <div className={styles["admin-history-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          データ操作履歴一覧
        </h1>

        {/* 管理者メニュー画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {/* 検索欄（2段構成） */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          {/* 1段目: 日付を選択し、「指定月検索」または「指定日検索」で絞り込む */}
          <div className={styles["search-group"]}>
            <label htmlFor="searchDayInput">就業日:</label>
            {/* 日付入力欄（入力しただけでは検索せず、ボタン押下で確定する） */}
            <input
              type="date"
              id="searchDayInput"
              name="day"
              value={searchDay}
              onChange={(e) => setSearchDay(e.target.value)}
              placeholder="日付を選択"
            />
            {/* 選択した日付と同じ年月の操作履歴をすべて表示 */}
            <button onClick={() => handleDaySearchClick(true)} className="gray_button">
              指定月検索
            </button>
            {/* 選択した日付の操作履歴のみ表示 */}
            <button onClick={() => handleDaySearchClick(false)} className="gray_button">
              指定日検索
            </button>
          </div>

          {/* 2段目: レコードID・操作テーブル・操作者従業員番号を入力し、「検索」で絞り込む */}
          <div className={styles["search-group"]}>
            {/* レコードID入力欄（部分一致で検索） */}
            <input
              type="text"
              name="id"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="レコードID"
            />
            {/* 操作テーブルの選択欄（先頭の空欄は「指定なし」） */}
            <select
              name="table"
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
            >
              <option value="">-- 操作テーブル選択 --</option>
              {/* サーバーから受け取ったテーブル名を1つずつ選択肢にする（key には並び順の番号を使う） */}
              {modelChoices.map((table, index) => (
                <option key={index} value={table}>{table}</option>
              ))}
            </select>
            {/* 操作者の従業員番号入力欄（部分一致で検索） */}
            <input
              type="text"
              name="no"
              value={searchNo}
              onChange={(e) => setSearchNo(e.target.value)}
              placeholder="操作者従業員番号"
            />
            {/* 入力中のすべての条件で検索 */}
            <button onClick={handleIDAndTableSearchClick} className="gray_button">
              検索
            </button>
          </div>
        </div>

        {/* データが0件ならメッセージ、1件以上なら一覧表を表示 */}
        {data.length === 0 && !loading ? (
          <p>No data found.</p>
        ) : (
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
          >
            <table>
              {/* 表の見出し行 */}
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>データ操作日時</th>
                  <th className={styles["th-collar"]}>操作者No</th>
                  <th className={styles["th-collar"]}>操作者</th>
                  <th className={styles["th-collar"]}>操作テーブル</th>
                  <th className={styles["th-collar"]}>レコードID</th>
                  <th className={styles["th-collar"]}>操作種類</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>

              {/* 表の本体: 操作履歴データ1件につき1行を表示（key には操作履歴データのIDを使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    {/* 操作日時（例: 2026-11-09 (10:30)） */}
                    <td>{formatTimestamp(item.timestamp)}</td>
                    {/* 操作者の従業員番号 */}
                    <td>{item.login_No}</td>
                    {/* 操作者の氏名 */}
                    <td>{item.operator_name}</td>
                    {/* 変更されたテーブル名 */}
                    <td>{item.table_name}</td>
                    {/* 変更されたレコードのID */}
                    <td>{item.record_id}</td>
                    {/* 操作種類（CREATE / UPDATE / DELETE） */}
                    <td>{item.operation}</td>
                    {/* データ操作履歴詳細画面へのリンク（URLに操作履歴データのIDを含める） */}
                    <td>
                      <Link
                        to={`/manager-history-detail/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ページ切り替えボタン（handlePageChange でページ番号とURLを更新し、useEffect で再取得される） */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={handlePageChange}
              buttonColor="#656565"
              hoverColor="#3a3a3a"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};
// ============================================================
// エクスポート
// ============================================================
export default AdministratorHistoryList;