/**
 * ============================================================
 * ファイル名 : DefDetailList.tsx
 * 種別       : 画面コンポーネント（作業詳細選択肢一覧画面）
 * 概要       : 工数入力で選べる作業詳細の選択肢（定義記号と作業詳細の文言の組）を一覧表示する画面。
 *              管理者のみ利用できる。定義記号で絞り込みができる。
 *
 * 主な機能   :
 *   - 作業詳細選択肢一覧の取得と表示（ページネーション付き。休憩「$」の選択肢は末尾）
 *   - 定義記号（工数区分の記号 A〜x、休憩は $）での絞り込み検索
 *   - 各行の「編集」「削除」リンクから作業詳細選択肢編集画面・削除画面へ遷移
 *
 * 使用API    : GET /api/def_detail_list/  作業詳細選択肢一覧取得（kosu/views/def_views.py の DefDetailList）
 * 画面URL    : /def-detail-list            （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefDetailList.module.css,
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
import styles from "../styles/DefinitionPage/DefDetailList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 作業詳細選択肢一覧の1行分のデータ（GET /api/def_detail_list/ のレスポンス results の要素） */
interface DetailData {
  id: number; // 作業詳細選択肢のID（主キー）。編集・削除画面のURLに使う
  def_symbol: string; // 定義記号（工数区分の記号 "A"〜"x"。"A" が工数区分1。"$" は休憩）
  def_select: string; // 作業詳細（選択肢として表示される文言）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 作業詳細選択肢一覧画面。
 *
 * 表示時・ページ切り替え時・検索時に、その条件の作業詳細選択肢を取得して表形式で表示する。
 *
 * @returns 作業詳細選択肢一覧画面のJSX
 */
const DefDeteDetailList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<DetailData[]>([]); // 表に表示する作業詳細選択肢（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [searchSymbol, setSearchSymbol] = useState<string>(""); // 絞り込みプルダウンで選択中の定義記号（検索ボタンを押すまで反映しない）
  const [currentFilterSymbol, setCurrentFilterSymbol] = useState<string>(""); // 実際に検索に使っている定義記号（空文字ならすべて）
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [allSymbols, setAllSymbols] = useState<string[]>([]); // 絞り込みプルダウンの選択肢（登録済みの定義記号一覧）
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 現在のページ・絞り込み条件で作業詳細選択肢一覧をサーバーから取得し、state に保存する。
   *
   * 401（未ログイン）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
   * currentPage / currentFilterSymbol が変わったときだけ作り直されるよう useCallback でメモ化し、
   * useEffect の依存配列に入れることで「条件が変わったら再取得」を実現している。
   *
   * @returns なし（結果は data / totalPages / allSymbols / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/def_detail_list/ : 作業詳細選択肢一覧を取得
      //   page      : 取得するページ番号
      //   def_symbol: 絞り込む定義記号（空文字ならサーバー側で絞り込みなし）
      const response = await api.get(
        "/api/def_detail_list/",
        {
          params: { 
            page: currentPage,
            def_symbol: currentFilterSymbol 
          }
        }
      );

      // results: 現在ページのデータ / page_size: 1ページの件数（管理者設定の一覧表示項目数）
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(response.data.count / pageSize));

      // symbol_list: 登録済みの定義記号一覧（絞り込みに関係なく全件分）。プルダウンの選択肢にする
      if (response.data.symbol_list) {
        setAllSymbols(response.data.symbol_list);
      }
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
  }, [currentPage, navigate, currentFilterSymbol]);

  // ---------- 副作用（useEffect） ----------

  // ページ番号が変わったとき・fetchData が作り直されたとき（＝絞り込み条件の変更時）:
  // その条件で一覧を取得し直す（初回表示時も実行される）
  useEffect(() => {
    fetchData();
  }, [currentPage, fetchData]);

  // ---------- イベントハンドラ ----------

  /**
   * 「検索」ボタン押下時の処理。
   *
   * プルダウンで選んだ定義記号を検索条件として確定し、1ページ目に戻す。
   * 条件の state が変わると fetchData が作り直され、useEffect によって再取得される。
   *
   * @returns なし
   */
  const handleSearch = () => {
    setCurrentFilterSymbol(searchSymbol);
    // 2ページ目以降を見ていた場合は1ページ目に戻す（絞り込み後は件数が変わるため）
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      {/* ローディング表示（ここでは loading は常に false のため、フェードアウトして1秒後に消える） */}
      <Loading isLoading={loading} />
      <div className={styles["def-detail-list-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          作業詳細選択肢一覧
        </h1>

        {/* 工数区分定義メニュー画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {/* 検索欄: 定義記号を選び「検索」で絞り込む（高さを表の高さ計算に使うため ref を付ける） */}
        <div 
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          {/* 定義記号の絞り込みプルダウン（「すべて」＝空文字は絞り込みなし。選択肢は登録済みの定義記号） */}
          <label>
            定義記号：
            <select
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              className={styles["search-select"]}
            >
              <option value="">すべて</option>
              {allSymbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>
          {/* 検索ボタン */}
          <button onClick={handleSearch} className="green_button">
            検索
          </button>
        </div>

        {/* 一覧表示エリア */}
        <div className={styles["table-wrapper"]}>
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
                    <th className={styles["th-collar"]}>定義記号</th>
                    <th className={styles["th-collar"]}>作業詳細</th>
                    <th className={styles["th-collar"]}>編集</th>
                    <th className={styles["th-collar"]}>削除</th>
                  </tr>
                </thead>
                {/* 表の本体: 作業詳細選択肢1件につき1行を表示（key には作業詳細選択肢のIDを使う） */}
                <tbody>
                  {data.map((item) => (
                    <tr key={item.id}>
                      {/* 定義記号 */}
                      <td>{item.def_symbol}</td>
                      {/* 作業詳細 */}
                      <td>{item.def_select}</td>
                      {/* 作業詳細選択肢編集画面へのリンク（URLに作業詳細選択肢のIDを含める） */}
                      <td>
                        <Link
                          to={`/def-detail-update/${item.id}`}
                          className={styles["a-collar"]}
                        >
                          編集
                        </Link>
                      </td>
                      {/* 作業詳細選択肢削除画面へのリンク（URLに作業詳細選択肢のIDを含める） */}
                      <td>
                        <Link
                          to={`/def-detail-delete/${item.id}`}
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
export default DefDeteDetailList;