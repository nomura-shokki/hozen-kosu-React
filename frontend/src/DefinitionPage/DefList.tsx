import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
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

  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/def_list/", { params: { page: currentPage } });
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else {
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["def-list-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          工数区分定義一覧
        </h1>

        <nav className={styles["def-nav"]} ref={searchBarRef}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        <div className={styles["search-bar"]}>
          {data.length === 0 ? (
            <p>No data found.</p>
          ) : (
            <TableContainer
              searchBarRef={searchBarRef}
              headerRef={headerRef}
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
                        <Link
                          to={`/def-update/${item.id}`}
                          className={styles["a-collar"]}
                        >
                          編集
                        </Link>
                      </td>
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

export default DefList;