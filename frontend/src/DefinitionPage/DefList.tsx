/**
 * ============================================================
 * ファイル名 : DefList.tsx
 * 種別       : 画面コンポーネント（工数区分定義一覧画面）
 * 概要       : 登録済みの工数区分定義Ver（作業カテゴリの定義セット）を新しい順に一覧表示する画面。
 *              管理者のみ利用できる。
 *
 * 主な機能   :
 *   - 工数区分定義Ver一覧の取得と表示（ページネーション付き）
 *   - 各行の「編集」「削除」リンクから工数区分定義編集画面・工数区分定義削除画面へ遷移
 *
 * 使用API    : GET /api/def_list/  工数区分定義一覧取得（kosu/views/def_views.py の DefList）
 * 画面URL    : /def-list            （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefList.module.css,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx
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
import styles from "../styles/DefinitionPage/DefList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数区分定義一覧の1行分のデータ（GET /api/def_list/ のレスポンス results の要素。使う項目のみ定義） */
interface DefData {
  id: number; // 工数区分定義のID（主キー）。編集・削除画面のURLに使う
  kosu_name: string; // 工数区分定義Ver名
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義一覧画面。
 *
 * 表示時・ページ切り替え時に、そのページの工数区分定義データを取得して表形式で表示する。
 *
 * @returns 工数区分定義一覧画面のJSX
 */
const DefList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<DefData[]>([]); // 表に表示する工数区分定義データ（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、ナビゲーションと見出しのDOM要素を参照する（TableContainer に渡す）
  //   ※この画面には検索欄がないため、searchBarRef はナビゲーション（nav）に付けている
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 現在のページの工数区分定義一覧をサーバーから取得し、state に保存する。
   *
   * 401（未ログイン）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
   * currentPage が変わったときだけ作り直されるよう useCallback でメモ化し、
   * useEffect の依存配列に入れることで「ページが変わったら再取得」を実現している。
   *
   * @returns なし（結果は data / totalPages / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/def_list/ : 工数区分定義一覧（ID の降順＝新しい順）を指定ページ分だけ取得
      const response = await api.get("/api/def_list/", { params: { page: currentPage } });
      // results: 現在ページのデータ / page_size: 1ページの件数（管理者設定の一覧表示項目数）
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
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
  }, [currentPage, navigate]);

  // ---------- 副作用（useEffect） ----------

  // fetchData が作り直されたとき（＝初回表示時・ページ番号が変わったとき）: 一覧を取得し直す
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["def-list-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          工数区分定義一覧
        </h1>

        {/* 工数区分定義メニュー画面へ戻るリンク（高さを表の高さ計算に使うため searchBarRef を付ける） */}
        <nav className={styles["def-nav"]} ref={searchBarRef}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {/* 一覧表示エリア */}
        <div className={styles["search-bar"]}>
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
                    <th className={styles["th-collar"]}>工数区分定義Ver</th>
                    <th className={styles["th-collar"]}>編集</th>
                    <th className={styles["th-collar"]}>削除</th>
                  </tr>
                </thead>
                {/* 表の本体: 工数区分定義1件につき1行を表示（key には工数区分定義のIDを使う） */}
                <tbody>
                  {data.map((item) => (
                    <tr key={item.id}>
                      {/* 工数区分定義Ver名 */}
                      <td>{item.kosu_name}</td>
                      {/* 工数区分定義編集画面へのリンク（URLに工数区分定義のIDを含める） */}
                      <td>
                        <Link
                          to={`/def-update/${item.id}`}
                          className={styles["a-collar"]}
                        >
                          編集
                        </Link>
                      </td>
                      {/* 工数区分定義削除画面へのリンク（URLに工数区分定義のIDを含める） */}
                      <td>
                        <Link
                          to={`/def-delete/${item.id}`}
                          className={styles["a-collar"]}
                        >
                          削除
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ページ切り替えボタン（押すと currentPage が変わり、fetchData が作り直されて再取得される） */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                buttonColor="#0f0"
                hoverColor="#32cd32"
              />
            </TableContainer>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefList;