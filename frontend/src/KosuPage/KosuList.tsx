/**
 * ============================================================
 * ファイル名 : KosuList.tsx
 * 種別       : 画面コンポーネント（工数履歴一覧画面）
 * 概要       : ログイン者本人の工数データを就業日の新しい順に一覧表示する画面。
 *              日付を1つ選び「指定日」または「指定月」で絞り込みができる。
 *
 * 主な機能   :
 *   - 工数データ一覧の取得と表示（ページネーション付き）
 *   - 指定日 / 指定月 での絞り込み検索
 *   - 各行の「編集」「削除」リンクから工数編集画面・工数削除画面へ遷移
 *
 * 使用API    : GET /api/kosu_list/  工数一覧取得（kosu/views/kosu_views.py の KosuList）
 * 画面URL    : /kosu-list            （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/KosuList.module.css,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate, useLocation } from "react-router-dom";
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/KosuPage/KosuList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数一覧の1行分のデータ（GET /api/kosu_list/ のレスポンス results の要素） */
interface Kosu {
  id: number; // 工数データのID（主キー）。編集・削除画面のURLに使う
  employee_no3: number; // 従業員番号
  name: string; // 氏名
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"。formatTyoku で表示名に変換する）
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 直の番号を画面表示用の名称に変換する。
 *
 * @param value - 直の番号（文字列 "1" でも数値 1 でも可）
 * @returns 直の名称（例: 1 → "1直"、4 → "常昼"）。該当しない値は空文字
 */
const formatTyoku = (value: string | number): string => {
  // 文字列で渡されても比較できるよう数値に変換してから判定する
  switch (Number(value)) {
    case 1: return "1直";
    case 2: return "2直";
    case 3: return "3直";
    case 4: return "常昼";
    case 5: return "連1直";
    case 6: return "連2直";
    default: return "";
  }
};

/**
 * 日付文字列から曜日（漢字1文字）を求める。
 *
 * @param dateStr - 日付文字列（"YYYY-MM-DD"）
 * @returns 曜日（"日"〜"土"）。日付として解釈できない場合は空文字
 */
const getDayOfWeek = (dateStr: string): string => {
  // Date.getDay() の戻り値（0=日曜〜6=土曜）の順に並べた曜日表
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr);
  // 不正な日付だと getDay() が NaN になり undefined となるため、空文字で代用する
  return days[date.getDay()] || "";
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数履歴一覧画面。
 *
 * 表示時に1ページ目の工数データを取得し、表形式で表示する。
 * 検索欄で日付を選んでボタンを押すと、その日（または月）のデータだけに絞り込む。
 *
 * @returns 工数履歴一覧画面のJSX
 */
const KosuList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Kosu[]>([]); // 表に表示する工数データ（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  // 検索欄で選択中の日付。入力のたびに再描画しないよう state ではなく ref で保持する
  const searchDayRef = useRef<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false); // true: 月単位で検索 / false: 日単位で検索
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const location = useLocation(); // 現在のURL情報（URLが変わったことの検知に使う）
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 工数データ一覧をサーバーから取得し、state に保存する。
   *
   * 検索日が指定されている場合のみ絞り込み用のパラメータを付けて送信する。
   * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * useEffect の依存配列に入れるため、useCallback で関数を使い回す（毎回作り直さない）。
   *
   * @param page - 取得するページ番号（1始まり）
   * @param day  - 検索日（"YYYY-MM-DD"）。空文字なら絞り込みなし
   * @param mode - true: 月単位で検索 / false: 日単位で検索
   * @returns なし（結果は data / totalPages / error の state に反映）
   */
  const fetchData = useCallback(async (
    page: number, // 取得するページ番号
    day: string, // 検索日（空文字なら絞り込みなし）
    mode: boolean
  ) => {
    setLoading(true);
    try {
      // GET /api/kosu_list/ : ログイン者の工数一覧を取得
      const response = await api.get("/api/kosu_list/", {
        params: {
          page: page,
          // 検索日がある場合だけ、絞り込み用のパラメータを追加する
          //   day   : 検索日
          //   mode  : "month"=同じ年月のデータすべて / "day"=その日のデータのみ
          //   filter: "true" のときだけサーバー側で絞り込みが行われる
          ...(day && {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
          })
        }
      });

      // results: 現在ページのデータ / page_size: 1ページの件数（管理者設定の一覧表示項目数）
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      } else {
        // 通信以外の予期しないエラー
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [navigate]);

  // ---------- 副作用（useEffect） ----------

  // 画面URL（pathname）が変わったとき: 検索条件をリセットして1ページ目に戻す
  // （メニューから再度この画面に来たときに前回の検索条件が残らないようにする）
  useEffect(() => {
    searchDayRef.current = "";
    // 日付入力欄は ref 管理（非制御コンポーネント）のため、DOMを直接操作して表示を空にする
    const input = document.getElementById("search-day-input") as HTMLInputElement;
    if (input) input.value = "";
    setSearchByMonth(false);
    setCurrentPage(1);
  }, [location.pathname]);

  // ページ番号または検索モードが変わったとき: その条件で一覧を取得し直す（初回表示時も実行される）
  useEffect(() => {
    fetchData(currentPage, searchDayRef.current, searchByMonth);
  }, [currentPage, fetchData, searchByMonth]);

  // ---------- イベントハンドラ ----------

  /**
   * 「指定月」「指定日」ボタン押下時の検索処理。
   *
   * 検索モードを保存し、1ページ目から検索結果を取得し直す。
   *
   * @param isMonthSearch - true: 指定月で検索 / false: 指定日で検索
   * @returns なし
   */
  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
    // state の更新を待たずに、押されたボタンの条件ですぐに取得する
    fetchData(1, searchDayRef.current, isMonthSearch); 
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <div className={styles["kosu-list-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          工数履歴
        </h1>

        {/* 工数メニュー画面へ戻るリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>

        {/* 検索欄: 日付を選択し、「指定月」または「指定日」で絞り込む */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label htmlFor="search-day-input"></label>
          {/* 日付入力欄: 値は state ではなく searchDayRef に保存する（入力のたびに再描画しない） */}
          <input
            id="search-day-input"
            type="date"
            defaultValue={searchDayRef.current}
            onChange={(e) => { searchDayRef.current = e.target.value; }}
            placeholder="日付を選択"
          />

          {/* 検索ボタン群 */}
          <div className={styles["button-group"]}>
            {/* 選択した日付と同じ年月のデータをすべて表示 */}
            <button
              onClick={() => handleSearch(true)}
              className="light_blue_button"
            >
              指定月
            </button>
            {/* 選択した日付のデータのみ表示 */}
            <button
              onClick={() => handleSearch(false)}
              className="light_blue_button"
            >
              指定日
            </button>
          </div>
        </div>

        {/* データが0件ならメッセージ、1件以上なら一覧表を表示 */}
        {data.length === 0 ? (
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
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>編集</th>
                  <th className={styles["th-collar"]}>削除</th>
                </tr>
              </thead>
              {/* 表の本体: 工数データ1件につき1行を表示（key には工数データのIDを使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    {/* 就業日と曜日（例: 2026-11-09 (月)） */}
                    <td>{item.work_day2} ({getDayOfWeek(item.work_day2)})</td>
                    {/* 直の名称 */}
                    <td>{formatTyoku(item.tyoku2)}</td>
                    {/* 整合性: 工数入力OK/NG判定に応じて文字と色を切り替える */}
                    <td
                      className={
                        item.judgement
                          ? styles["status-ok"]
                          : styles["status-ng"]
                      }
                    >
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    {/* 工数編集画面へのリンク（URLに工数データのIDを含める） */}
                    <td>
                      <Link
                        to={`/kosu-update/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        編集
                      </Link>
                    </td>
                    {/* 工数削除画面へのリンク（URLに工数データのIDを含める） */}
                    <td>
                      <Link
                        to={`/kosu-delete/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        削除
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ページ切り替えボタン（押すと currentPage が変わり、useEffect で再取得される） */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              buttonColor="#0ff"
              hoverColor="#0af"
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
export default KosuList;