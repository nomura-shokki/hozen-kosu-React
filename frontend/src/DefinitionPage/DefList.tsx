import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading";
import TableContainer from "../Components/TableContainer";
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
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/def_list/`, {
        params: {page: currentPage},
        withCredentials: true,
      });

      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  }, [currentPage, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages);
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義一覧</h1>
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        <div className={styles["search-bar"]}>
          {data.length === 0 ? (
            <p>No data found.</p>
          ) : (
            <TableContainer 
              searchBarSelector={`.${styles["search-bar"]}`}
              headerSelector={`.${styles["h1-collar"]}`}
            >
              <table>
                <thead>
                  <tr>
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
            </TableContainer>
          )}
        </div>
      </div>
    </>
  );
};

export default DefList;