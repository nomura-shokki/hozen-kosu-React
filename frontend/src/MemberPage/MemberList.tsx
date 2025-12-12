import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import ShopSelect from "../components/ShopSelect";
import styles from "../styles/MemberPage/MemberList.module.css";

// Member 型定義。従業員情報のデータ構造を示す
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ名
  authority: boolean; // 権限の有無
  administrator: boolean; // 管理者権限の有無
}

const MemberList: React.FC = () => {
  // useStateフックで状態管理: 各種データ、エラー情報、ローディング状態など
  const [data, setData] = useState<Member[]>([]); // 従業員データ
  const [loading, setLoading] = useState<boolean>(true); // データロード中状態
  const [error, setError] = useState<string | null>(null); // エラーメッセージ
  const [searchNumber, setSearchNumber] = useState<string>(""); // 従業員番号の検索条件
  const [searchShop, setSearchShop] = useState<string>(""); // ショップ名の検索条件
  const [currentFilterNumber, setCurrentFilterNumber] = useState<string>(""); // 現在適用中の従業員番号フィルター
  const [currentFilterShop, setCurrentFilterShop] = useState<string>(""); // 現在適用中のショップフィルター
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在のページ番号
  const [totalPages, setTotalPages] = useState<number>(0); // 全ページ数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブルの最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブルの幅
  const tableRef = useRef<HTMLTableElement>(null); // テーブル要素の参照
  const navigate = useNavigate(); // ルートナビゲーション用

  // データをAPIから取得する関数。useCallbackで最適化
  const fetchData = useCallback(async () => {
    setLoading(true); // ローディング状態をtrueに設定
    try {
      // APIコールでデータを取得
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/member_list/`, {
        params: {
          page: currentPage, // 現在のページ番号を使用
          employee_no: currentFilterNumber,
          shop: currentFilterShop,
        },
        withCredentials: true, // クッキーを含めたリクエスト
      });

      const results = response.data.results || []; // 結果データの取得（デフォルト空配列）
      const pageSize = response.data.page_size || 20; // 1ページのデータ数（デフォルト20）
      setData(results); // データをステートに保存
      setTotalPages(Math.ceil(response.data.count / pageSize)); // 全ページ数を計算して設定
    } catch (err) {
      // エラーハンドリング
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login"); // 認証エラーでログイン画面へリダイレクト
        } else if (err.response?.status === 403) {
          navigate("/"); // 権限エラーでホームにリダイレクト
        } else {
          setError(err.message); // それ以外のエラーはメッセージを表示
        }
      } else {
        setError("予期しないエラーが発生しました"); // その他の捕捉エラー
      }
    } finally {
      setLoading(false); // ローディング状態を終了
    }
  }, [currentPage, navigate, currentFilterNumber, currentFilterShop]);

  useEffect(() => {
    fetchData();
  }, [currentPage, fetchData]);

  // 検索条件を適用してデータを再取得
  const handleSearch = () => {
    setCurrentFilterNumber(searchNumber);
    setCurrentFilterShop(searchShop);

    if (currentPage !== 1) {
      setCurrentPage(1);
    } 
    else {
    }
  };

  // ページ送り関連のハンドラ (変更なし)
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1); // 次ページに進む
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1); // 前ページに戻る
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1); // 最初のページに移動
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages); // 最後のページに移動
  };

  // ウィンドウサイズ変更時にテーブルの最大高さを再計算
  useEffect(() => {
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(`.${styles["search-bar"]}`) as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40); // スペースを差し引いて高を設定
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight); // リサイズイベントのリスナー追加
    return () => window.removeEventListener("resize", updateMaxHeight); // クリーンアップ
  }, []);

  // テーブルの幅を更新するuseEffect
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth); // リサイズイベント
  }, [data]);

  // エラーが発生した場合はエラーメッセージを表示
  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      {/* コンテンツ全体のラッパー */}
      <div className={styles["member-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>人員データ一覧</h1>
        <nav className={styles["member-nav"]}>
          {/* 人員MENUへのリンク */}
          <Link to="/member-menu">人員MENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          {/* 検索用のフィルター入力 */}
          <label>
            従業員番号：
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="従業員番号を入力"
            />
          </label>
          <label>
            ショップ：
            <ShopSelect
              name="shopFilter"
              value={searchShop}
              onChange={(e) => setSearchShop(e.target.value)}
            />
          </label>
          <button onClick={handleSearch} className="yellow_button">検索</button>
        </div>
        {data.length === 0 ? (
          <p>No data found.</p>
        ) : (
          <div
            className={styles["table-wrapper"]}
            style={{
              maxHeight: `${maxHeight}px`, // テーブルの縦サイズを設定
              overflowY: "auto",
              width: `${tableWidth + 20}px`, // テーブル横サイズを設定
            }}
          >
            {/* データ表示用のテーブル */}
            <table ref={tableRef}>
              <thead>
                <tr>
                  {/* テーブルヘッダ */}
                  <th className={styles["th-collar"]}>従業員番号</th>
                  <th className={styles["th-collar"]}>氏名</th>
                  <th className={styles["th-collar"]}>ショップ</th>
                  <th className={styles["th-collar"]}>権限</th>
                  <th className={styles["th-collar"]}>管理者権限</th>
                  <th className={styles["th-collar"]}>編集</th>
                  <th className={styles["th-collar"]}>削除</th>
                </tr>
              </thead>
              <tbody>
                {/* データ一覧を表示 */}
                {data.map((item) => (
                  <tr key={item.employee_no}>
                    <td>{item.employee_no}</td>
                    <td>{item.name}</td>
                    <td>{item.shop}</td>
                    <td>{item.authority ? "有" : "無"}</td>
                    <td>{item.administrator ? "有" : "無"}</td>
                    {/* 編集・削除リンク */}
                    <td>
                      <Link to={`/member-update/${item.employee_no}`} className={styles["a-collar"]}>編集</Link>
                    </td>
                    <td>
                      <Link to={`/member-delete/${item.employee_no}`} className={styles["a-collar"]}>削除</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* ページネーション */}
            <div className={styles["pagination"]}>
              <button className={styles["prev-button"]} disabled={currentPage === 1} onClick={handleFirstPage}>
                最初
              </button>
              <button className={styles["prev-button"]} disabled={currentPage === 1} onClick={handlePreviousPage}>
                前
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button className={styles["next-button"]} disabled={currentPage === totalPages} onClick={handleNextPage}>
                次
              </button>
              <button className={styles["next-button"]} disabled={currentPage === totalPages} onClick={handleLastPage}>
                最後
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MemberList;