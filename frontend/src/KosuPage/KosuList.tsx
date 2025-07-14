import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/KosuList.module.css";

interface Kosu {
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  judgement: boolean;
}

const KosuList: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDay, setSearchDay] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/Kosu_list/`, {
        params: {
          page: currentPage, 
          day: searchDay, 
        },
        withCredentials: true,
      });

      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(err.message);
        }
      } else {
        setError("予期しないエラーが発生しました");
      }
    } finally {
      setLoading(false);
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData();
  };

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

  useEffect(() => {
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(".search-bar") as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40);
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [data]);

  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={isLoading} />
      <div className={styles["member-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数履歴</h1>
        <nav className={styles["member-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <label>
            従業員番号：
            <input
              type="text"
              value={searchDay}
              onChange={(e) => setSearchDay(e.target.value)}
              placeholder="就業日を選択"
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
              maxHeight: `${maxHeight}px`,
              overflowY: "auto",
              width: `${tableWidth + 20}px`,
            }}
          >
            <table ref={tableRef}>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>編集</th>
                  <th className={styles["th-collar"]}>削除</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.work_day2}>
                    <td>{item.work_day2}</td>
                    <td>{item.tyoku2}</td>
                    <td>{item.judgement ? "OK" : "NG"}</td>
                    <td>
                      <Link to={`/member-update/${item.employee_no3}`} className={styles["a-collar"]}>編集</Link>
                    </td>
                    <td>
                      <Link to={`/member-delete/${item.employee_no3}`} className={styles["a-collar"]}>削除</Link>
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
          </div>
        )}
      </div>
    </>
  );
};

export default KosuList;