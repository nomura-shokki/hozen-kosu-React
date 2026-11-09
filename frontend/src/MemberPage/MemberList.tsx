/**
 * ============================================================
 * ファイル名 : MemberList.tsx
 * 種別       : 画面コンポーネント（人員一覧画面）
 * 概要       : 登録済みの人員（従業員）データを一覧表示する画面。権限ありの人員のみ利用できる。
 *              従業員番号・ショップで絞り込みができる。
 *
 * 主な機能   :
 *   - 人員データ一覧の取得と表示（ページネーション付き。「異動・退社」の人員は末尾）
 *   - 従業員番号（部分一致）/ ショップ（完全一致）での絞り込み検索
 *   - 各行の「編集」「削除」リンクから人員編集画面・人員削除画面へ遷移
 *
 * 使用API    : GET /api/member_list/  人員一覧取得（kosu/views/member_views.py の MemberList）
 * 画面URL    : /member-list            （index.tsx のルーティング定義）
 * 関連ファイル: styles/MemberPage/MemberList.module.css, Components/ShopSelect.tsx,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import ShopSelect from "../Components/ShopSelect"; // ショップを選ぶプルダウン
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/MemberPage/MemberList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 人員一覧の1行分のデータ（GET /api/member_list/ のレスポンス results の要素。表示する項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号。編集・削除画面のURLと行の key に使う
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（true: 人員・班員の管理画面を使える）
  administrator: boolean; // 管理者（true: 管理者・工数区分定義の編集画面を使える）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 人員一覧画面。
 *
 * 表示時・ページ切り替え時・検索時に、その条件の人員データを取得して表形式で表示する。
 *
 * @returns 人員一覧画面のJSX
 */
const MemberList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Member[]>([]); // 表に表示する人員データ（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [searchNumber, setSearchNumber] = useState<string>(""); // 検索欄に入力中の従業員番号（検索ボタンを押すまで反映しない）
  const [searchShop, setSearchShop] = useState<string>(""); // 検索欄で選択中のショップ（検索ボタンを押すまで反映しない）
  const [currentFilterNumber, setCurrentFilterNumber] = useState<string>(""); // 実際に検索に使っている従業員番号（空文字なら絞り込みなし）
  const [currentFilterShop, setCurrentFilterShop] = useState<string>(""); // 実際に検索に使っているショップ（空文字なら絞り込みなし）
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 現在のページ・絞り込み条件で人員一覧をサーバーから取得し、state に保存する。
   *
   * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * ページ番号・絞り込み条件が変わったときだけ作り直されるよう useCallback でメモ化し、
   * useEffect の依存配列に入れることで「条件が変わったら再取得」を実現している。
   *
   * @returns なし（結果は data / totalPages / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/member_list/ : 人員一覧を取得
      //   page       : 取得するページ番号
      //   employee_no: 従業員番号の部分一致検索（空文字ならサーバー側で絞り込みなし）
      //   shop       : ショップの完全一致検索（空文字ならサーバー側で絞り込みなし）
      const response = await api.get(
        "/api/member_list/",
        {
          params: {
            page: currentPage,
            employee_no: currentFilterNumber,
            shop: currentFilterShop,
          }
        }
      );

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
        // 403: 権限なし（人員の「権限」が付いていない） → メインメニューへ
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
  }, [currentPage, navigate, currentFilterNumber, currentFilterShop]);

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
   * 検索欄の入力内容を検索条件として確定し、1ページ目に戻す。
   * 条件の state が変わると fetchData が作り直され、useEffect によって再取得される。
   *
   * @returns なし
   */
  const handleSearch = () => {
    setCurrentFilterNumber(searchNumber);
    setCurrentFilterShop(searchShop);

    // 2ページ目以降を見ていた場合は1ページ目に戻す（絞り込み後は件数が変わるため）
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      // 1ページ目なら何もしない（条件の変更だけで再取得される）
    }
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["member-list-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          人員データ一覧
        </h1>

        {/* 人員メニュー画面へ戻るリンク */}
        <nav className={styles["member-nav"]}>
          <Link to="/member-menu">人員MENU</Link>
        </nav>

        {/* 検索欄: 従業員番号・ショップを指定し「検索」で絞り込む（高さを表の高さ計算に使うため ref を付ける） */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          {/* 従業員番号の入力欄（部分一致で検索される） */}
          <label>
            従業員番号：
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="従業員番号を入力"
            />
          </label>
          {/* ショップのプルダウン（「---」＝空文字は絞り込みなし） */}
          <label>
            ショップ：
            <ShopSelect
              name="shopFilter"
              value={searchShop}
              onChange={(e) => setSearchShop(e.target.value)}
            />
          </label>
          {/* 検索ボタン */}
          <button onClick={handleSearch} className="yellow_button">
            検索
          </button>
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
                  <th className={styles["th-collar"]}>従業員番号</th>
                  <th className={styles["th-collar"]}>氏名</th>
                  <th className={styles["th-collar"]}>ショップ</th>
                  <th className={styles["th-collar"]}>権限</th>
                  <th className={styles["th-collar"]}>管理者権限</th>
                  <th className={styles["th-collar"]}>編集</th>
                  <th className={styles["th-collar"]}>削除</th>
                </tr>
              </thead>
              {/* 表の本体: 人員1人につき1行を表示（key には従業員番号を使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.employee_no}>
                    {/* 従業員番号・氏名・ショップ */}
                    <td>{item.employee_no}</td>
                    <td>{item.name}</td>
                    <td>{item.shop}</td>
                    {/* 権限・管理者権限: true なら「有」、false なら「無」と表示 */}
                    <td>{item.authority ? "有" : "無"}</td>
                    <td>{item.administrator ? "有" : "無"}</td>
                    {/* 人員編集画面へのリンク（URLに従業員番号を含める） */}
                    <td>
                      <Link
                        to={`/member-update/${item.employee_no}`}
                        className={styles["a-collar"]}
                      >
                        編集
                      </Link>
                    </td>
                    {/* 人員削除画面へのリンク（URLに従業員番号を含める） */}
                    <td>
                      <Link
                        to={`/member-delete/${item.employee_no}`}
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
              buttonColor="#ffd700"
              hoverColor="#ffa500"
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
export default MemberList;