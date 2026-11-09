/**
 * ============================================================
 * ファイル名 : AdministratorTaskList.tsx
 * 種別       : 画面コンポーネント（非同期タスクデータ管理画面）
 * 概要       : 非同期タスク（バックアップ/復元などのバックグラウンド処理）の記録を
 *              作成日時の新しい順に一覧表示する管理者向け画面。
 *              日付を1つ選び「指定日」または「指定月」で絞り込みができる。
 *
 * 主な機能   :
 *   - 非同期タスクデータ一覧の取得と表示（ページネーション付き）
 *   - 日付入力の変更時に即時検索、「指定月」「指定日」ボタンで検索単位の切り替え
 *   - 各行の「詳細」リンクから非同期タスク詳細画面へ遷移
 *
 * 使用API    : GET /api/manager_task/  非同期タスク一覧取得（kosu/views/main_views.py の AdministratorTaskList）
 * 画面URL    : /manager-task            （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorTaskList.module.css,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx,
 *              AdministratorPage/AdministratorTaskDetail.tsx（詳細画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/AdministratorPage/AdministratorTaskList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 非同期タスク一覧の1行分のデータ（GET /api/manager_task/ のレスポンス task_data.results の要素） */
interface Task {
  id: number; // 非同期タスクデータのID（主キー）。詳細画面のURLに使う
  task_id: string; // タスクの識別子（バックアップ等の開始時にサーバーが UUID で発行）
  status: string; // 状態（"pending"=処理中 / "success"=成功 / "error"=失敗）
  result: string; // 処理結果（成功時は作成ファイルのパス等、失敗時はエラーメッセージ）
  created_at: string; // 作成日時（ISO形式の日時文字列）
  updated_at: string; // 最終更新日時（ISO形式の日時文字列）
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
    if (isNaN(date.getTime())) {
      return timestamp;
    }

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
 * 非同期タスクデータ管理画面。
 *
 * 表示時に1ページ目の非同期タスクデータを取得し、表形式で表示する。
 * 日付を選ぶとすぐに検索し、「指定月」「指定日」ボタンで検索単位を切り替える。
 *
 * @returns 非同期タスクデータ管理画面のJSX
 */
const AdministratorTaskList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Task[]>([]); // 表に表示する非同期タスクデータ（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [searchDay, setSearchDay] = useState<string>(""); // 検索欄で選択中の日付（"YYYY-MM-DD"。空文字なら絞り込みなし）
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false); // true: 月単位で検索 / false: 日単位で検索
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 非同期タスクデータ一覧をサーバーから取得し、state に保存する。
   *
   * 検索日が指定されている場合のみ絞り込み用のパラメータを付けて送信する。
   * 401（未ログイン）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
   * useEffect の依存配列に入れるため、useCallback で関数を使い回す（毎回作り直さない）。
   *
   * @param page - 取得するページ番号（1始まり）
   * @param day  - 検索日（"YYYY-MM-DD"）。空文字なら絞り込みなし
   * @param mode - true: 月単位で検索 / false: 日単位で検索
   * @returns なし（結果は data / totalPages / error の state に反映）
   */
  const fetchData = useCallback(async (
    page: number, 
    day: string, 
    mode: boolean,
  ) => {
    setLoading(true);
    try {
      // GET /api/manager_task/ : 非同期タスクデータ一覧を取得
      const response = await api.get("/api/manager_task/", {
        params: {
          page: page,
          // 検索日がある場合だけ、絞り込み用のパラメータを追加する
          //   day : 検索日
          //   mode: "month"=作成日時が同じ年月のデータすべて / "day"=作成日がその日のデータのみ
          ...(day ? { 
            day: day,
            mode: mode ? "month" : "day",
          } : {}),
        }
      });

      // task_data の中に count / page_size / results（現在ページのデータ）が入っている
      const taskData = response.data?.task_data || {};
      const results = taskData.results || [];
      // page_size: 1ページの件数（管理者設定の一覧表示項目数）。取得できなければ20件とみなす
      const pageSize = taskData.page_size || 20;
      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(taskData.count / pageSize));
      // 各行をコピーして表示用データにする（現状は項目の加工はしていない）
      const transformedData = results.map((item: Task) => ({
        ...item,
      }));
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

  // ページ番号・検索日・検索モードのいずれかが変わったとき: その条件で一覧を取得し直す
  // （初回表示時も実行される）
  useEffect(() => {
    fetchData(currentPage, searchDay, searchByMonth);
  }, [currentPage, fetchData, searchDay, searchByMonth]); 

  // ---------- イベントハンドラ ----------

  /**
   * 日付入力欄の値が変わったときの処理。
   *
   * 選択した日付を保存し、現在の検索モード（月/日）のまま1ページ目から検索し直す。
   *
   * @param e - 日付入力欄の変更イベント
   * @returns なし
   */
  const handleSearchDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDay = e.target.value;
    setSearchDay(newDay);
    setCurrentPage(1);
    // state の更新を待たずに、入力された日付ですぐに取得する
    // （searchDay の変化で上の useEffect からも取得が実行される）
    fetchData(1, newDay, searchByMonth);
  };

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
    fetchData(1, searchDay, isMonthSearch);
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["admin-task-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          非同期タスクデータ管理
        </h1>

        {/* 管理者メニュー画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {/* 検索欄: 日付を選択し、「指定月」または「指定日」で絞り込む */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label htmlFor="searchDayInput">就業日：</label>
          {/* 日付入力欄: 値を変えるとすぐに検索が実行される */}
          <input 
            type="date" 
            id="searchDayInput" 
            value={searchDay} 
            onChange={handleSearchDayChange} 
            placeholder="日付を選択"
          />
          {/* 検索ボタン群 */}
          <div className={styles["button-group"]}>
            {/* 選択した日付と同じ年月に作成されたデータをすべて表示 */}
            <button
              onClick={() => handleSearch(true)}
              className="gray_button"
            >
              指定月
            </button>
            {/* 選択した日付に作成されたデータのみ表示 */}
            <button
              onClick={() => handleSearch(false)}
              className="gray_button"
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
                  <th className={styles["th-collar"]}>タスク作成日</th>
                  <th className={styles["th-collar"]}>状態</th>
                  <th className={styles["th-collar"]}>タスクID</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>
              {/* 表の本体: 非同期タスクデータ1件につき1行を表示（key には非同期タスクデータのIDを使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    {/* 作成日時（例: 2026-11-09 (10:30)） */}
                    <td>{formatTimestamp(item.created_at)}</td>
                    {/* 状態（pending / success / error） */}
                    <td>{item.status}</td>
                    {/* タスクの識別子（UUID） */}
                    <td>{item.task_id}</td>
                    {/* 非同期タスク詳細画面へのリンク（URLに非同期タスクデータのIDを含める） */}
                    <td>
                      <Link
                        to={`/manager-task-detail/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        詳細
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
export default AdministratorTaskList;