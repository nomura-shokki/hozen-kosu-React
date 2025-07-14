import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefList.module.css";

interface DefData {
  id: number;
  kosu_name: string;
}

const DefList: React.FC = () => {
  const [data, setData] = useState<DefData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate();

  // データを取得する関数
  const fetchData = async () => {
    setLoading(true); // ローディング状態を開始
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/def_list/`, {
        params: {
          page: currentPage, // 現在のページ番号
        },
        withCredentials: true, // クッキーを使用するリクエストを許可
      });

      // レスポンスデータを構造的に処理
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize)); // 総ページ数を計算
    } catch (err) {
      // エラー処理
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login"); // 未認証の場合、ログイン画面へ
        } else if (err.response?.status === 403) {
          navigate("/"); // アクセス拒否の場合、ホーム画面へ
        } else {
          setError(err.message); // その他のエラーを設定
        }
      } else {
        setError("予期しないエラーが発生しました"); // 予期しないエラーの場合
      }
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時と `currentPage` の変更時に fetchData を実行
  useEffect(() => {
    fetchData();
  }, [currentPage]);

  // ページング関数
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1); // 次のページへ
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1); // 前のページへ
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1); // 最初のページへ
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages); // 最後のページへ
  };

  useEffect(() => {
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;

      setMaxHeight(window.innerHeight - headerHeight - 40);
    };

    updateMaxHeight();
  
    // ウィンドウサイズが変更された際にも最大高さを再計算。
    window.addEventListener("resize", updateMaxHeight);
  
    // コンポーネントがアンマウントされる際にリサイズイベントリスナーを削除し、メモリリークを防ぐ。
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // テーブル幅を更新
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth); // 現在のテーブル幅をセット
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth); // リサイズ時にテーブル幅を再計算
    return () => window.removeEventListener("resize", updateTableWidth); // クリーンアップ
  }, [data]);

  // エラー表示
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義一覧</h1>

        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {data.length === 0 ? (
          <p>No data found.</p> // データがない場合
        ) : (
          <div
            className={styles["table-wrapper"]}
            style={{
              maxHeight: `${maxHeight}px`, // 最大高さ
              overflowY: "auto", // 縦スクロールを有効化
              width: `${tableWidth + 5}px`, // テーブル幅
            }}
          >
            {/* データテーブル */}
            <table ref={tableRef}>
              <thead>
                <tr>
                  {/* テーブルヘッダー */}
                  <th className={styles["th-collar"]}>工数区分定義Ver</th>
                  <th className={styles["th-collar"]}>編集</th>
                  <th className={styles["th-collar"]}>削除</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.kosu_name}</td>
                    <td>
                      <Link to={`/def-update/${item.id}`} className={styles["a-collar"]}>編集</Link>
                    </td>
                    <td>
                      <Link to={`/def-delete/${item.id}`} className={styles["a-collar"]}>削除</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ページング */}
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

export default DefList;