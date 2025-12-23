import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorHistoryList.module.css";

interface History {
  id: number;
  operation: string;
  table_name: string;
  record_id: string;
  login_No: string;
  timestamp: string;
}

const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
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

const AdministratorHistoryList: React.FC = () => {
  const [data, setData] = useState<History[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchFields, setSearchFields] = useState({
    day: "",
    id: "",
    no: "",
    table: ""
  });

  const [queries, setQueries] = useState({
    day: "",
    id: "",
    no: "",
    table: ""
  });

  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [modelChoices, setModelChoices] = useState<string[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchData = useCallback(async (
    page: number,
    day: string,
    mode: boolean,
    id: string,
    table: string,
    loginNo: string,
  ) => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/manager_history/`, {
        params: {
          page: page,
          record_id: id,
          day: day,
          mode: mode ? "month" : "day",
          table_name: table,
          login_No: loginNo,
        },
        withCredentials: true,
      });

      const historyData = response.data?.history_data || {};
      const ModelChoices = response.data?.model_choices || {};

      if (Array.isArray(ModelChoices)) setModelChoices(ModelChoices);

      const results = historyData.results || [];
      const count = historyData.count || 0;
      const pageSize = results.length > 0 ? historyData.count / Math.ceil(historyData.count / results.length) : 20;
      setTotalPages(Math.ceil(count / pageSize));
      setData(results);

    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.message);
      } else {
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    setSearchFields({ day: "", id: "", no: "", table: "" });
    setQueries({ day: "", id: "", no: "", table: "" });
    setSearchByMonth(false);
    setCurrentPage(1);
  }, [location.pathname]);

  useEffect(() => {
    fetchData(currentPage, queries.day, searchByMonth, queries.id, queries.table, queries.no);
  }, [currentPage, fetchData, queries, searchByMonth]);

  // 入力ハンドラの統合
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSearchFields(prev => ({ ...prev, [name]: value }));
  };

  const handleDaySearchClick = (isMonthSearch: boolean) => {
    setQueries(prev => ({ ...prev, day: searchFields.day }));
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
  };

  const handleIDAndTableSearchClick = () => {
    setQueries({ ...searchFields });
    setCurrentPage(1);
  };

  const handlePageChange = (targetPage: number) => {
    if (targetPage >= 1 && targetPage <= totalPages) {
      setCurrentPage(targetPage);
    }
  };

  useEffect(() => {
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(`.${styles["search-bar"]}`) as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector(`.${styles["h1-collar"]}`) as HTMLElement)?.offsetHeight || 0;
      const containerPadding = 40;
      const newMaxHeight = window.innerHeight - searchBarHeight - headerHeight - containerPadding - 50;
      setMaxHeight(Math.max(200, newMaxHeight));
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
    };
    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [data]);

  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-history-wrapper"]}>
        <h1 className={styles["h1-collar"]}>データ操作履歴一覧</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <div className={styles["search-group"]}>
            <label htmlFor="searchDayInput">就業日:</label>
            <input
              type="date"
              id="searchDayInput"
              name="day"
              value={searchFields.day}
              onChange={handleInputChange}
              placeholder="日付を選択"
            />
            <button onClick={() => handleDaySearchClick(true)} className="gray_button">
              指定月検索
            </button>
            <button onClick={() => handleDaySearchClick(false)} className="gray_button">
              指定日検索
            </button>
          </div>
          <div className={styles["search-group"]}>
            <input
              type="text"
              name="id"
              value={searchFields.id}
              onChange={handleInputChange}
              placeholder="レコードID"
            />
            <select
              name="table"
              value={searchFields.table}
              onChange={handleInputChange}
            >
              <option value="">-- 操作テーブル選択 --</option>
              {modelChoices.map((table, index) => (
                <option key={index} value={table}>{table}</option>
              ))}
            </select>
            <input
              type="text"
              name="no"
              value={searchFields.no}
              onChange={handleInputChange}
              placeholder="操作者従業員番号"
            />
            <button onClick={handleIDAndTableSearchClick} className="gray_button">検索</button>
          </div>
        </div>
        {data.length === 0 && !loading ? (
          <p>No data found.</p>
        ) : (
          <div
            className={styles["table-wrapper"]}
            style={{
              minHeight: `${maxHeight}px`,
              overflowY: "auto",
              width: tableWidth > 0 ? `${tableWidth + 20}px` : "100%",
              maxWidth: "100vw",
            }}
          >
            <table ref={tableRef}>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>データ操作日時</th>
                  <th className={styles["th-collar"]}>操作者</th>
                  <th className={styles["th-collar"]}>操作テーブル</th>
                  <th className={styles["th-collar"]}>レコードID</th>
                  <th className={styles["th-collar"]}>操作種類</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTimestamp(item.timestamp)}</td>
                    <td>{item.login_No}</td>
                    <td>{item.table_name}</td>
                    <td>{item.record_id}</td>
                    <td>{item.operation}</td>
                    <td>
                      <Link to={`/manager-history-detail/${item.id}`} className={styles["a-collar"]}>詳細</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles["pagination"]}>
              <button className={styles["prev-button"]} disabled={currentPage === 1} onClick={() => handlePageChange(1)}>最初</button>
              <button className={styles["prev-button"]} disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)}>前</button>
              <span>{currentPage} / {totalPages}</span>
              <button className={styles["next-button"]} disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)}>次</button>
              <button className={styles["next-button"]} disabled={currentPage === totalPages} onClick={() => handlePageChange(totalPages)}>最後</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdministratorHistoryList;