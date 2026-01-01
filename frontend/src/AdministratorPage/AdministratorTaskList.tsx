import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/AdministratorPage/AdministratorTaskList.module.css";

interface Task {
  id: number;
  task_id: string;
  status: string;
  result: string;
  created_at: string;
  updated_at: string;
}

const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return timestamp;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} (${hours}:${minutes})`;
  } catch (error) {
    console.error("Failed to format timestamp:", error);
    return timestamp;
  }
};

const AdministratorTaskList: React.FC = () => {
  const [data, setData] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDay, setSearchDay] = useState<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const navigate = useNavigate();

  const fetchData = useCallback(async (
    page: number, 
    day: string, 
    mode: boolean,
  ) => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/manager_task/`, {
        params: {
          page: page,
          ...(day ? { 
            day: day,
            mode: mode ? "month" : "day",
          } : {}),
        },
        withCredentials: true,
      });

      const taskData = response.data?.task_data || {};
      const results = taskData.results || [];
      const pageSize = taskData.page_size || 20;
      setTotalPages(Math.ceil(taskData.count / pageSize));
      const transformedData = results.map((item: Task) => ({
        ...item,
      }));
      setData(transformedData);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  }, [navigate]); 

  useEffect(() => {
    fetchData(currentPage, searchDay, searchByMonth);
  }, [currentPage, fetchData, searchDay, searchByMonth]); 

  const handleSearchDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDay = e.target.value;
    setSearchDay(newDay);
    setCurrentPage(1);
    fetchData(1, newDay, searchByMonth);
  };

  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
    fetchData(1, searchDay, isMonthSearch);
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-task-wrapper"]}>
        <h1 className={styles["h1-collar"]}>非同期タスクデータ管理</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <label htmlFor="searchDayInput">就業日：</label>
          <input 
            type="date" 
            id="searchDayInput" 
            value={searchDay} 
            onChange={handleSearchDayChange} 
            placeholder="日付を選択"
          />
          <div className={styles["button-group"]}>
            <button
              onClick={() => handleSearch(true)}
              className="gray_button"
            >
              指定月
            </button>
            <button
              onClick={() => handleSearch(false)}
              className="gray_button"
            >
              指定日
            </button>
          </div>
        </div>
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
                  <th className={styles["th-collar"]}>タスク作成日</th>
                  <th className={styles["th-collar"]}>状態</th>
                  <th className={styles["th-collar"]}>タスクID</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTimestamp(item.created_at)}</td>
                    <td>{item.status}</td>
                    <td>{item.task_id}</td>
                    <td>
                      <Link to={`/manager-task-detail/${item.id}`} className={styles["a-collar"]}>詳細</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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

export default AdministratorTaskList;