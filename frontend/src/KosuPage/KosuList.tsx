import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/KosuList.module.css";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  judgement: boolean;
}

const formatTyoku = (value: string | number): string => {
  switch (Number(value)) {
    case 1: return "1直";
    case 2: return "2直";
    case 3: return "3直";
    case 4: return "常昼";
    case 5: return "連1直";
    case 6: return "連2直";
    default: return "";
  }
};

const getDayOfWeek = (dateStr: string): string => {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr);
  return days[date.getDay()] || ""; // 日付が無効の場合は空文字を返す
};

const KosuList: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDay, setSearchDay] = useState<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchData = useCallback(async (targetMode: boolean | null = null) => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_list/`, {
        params: {
          page: currentPage,
          ...(searchDay && {
            day: searchDay,
            mode: targetMode !== null ? (targetMode ? "month" : "day") : (searchByMonth ? "month" : "day"),
            filter: "true",
          }),
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
    }
  }, [currentPage, navigate, searchByMonth, searchDay]);

  useEffect(() => {
    setSearchDay("");
    setSearchByMonth(false);
    setCurrentPage(1);
  }, [location.pathname]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    fetchData(isMonthSearch);
    setCurrentPage(1);
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
      <Loading isLoading={loading} />
      <div className={styles["kosu-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数履歴</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <label onClick={() => dateInputRef.current?.showPicker?.()}>
            就業日：
            <input
              type="date"
              ref={dateInputRef}
              value={searchDay}
              onChange={(e) => setSearchDay(e.target.value)}
              placeholder="日付を選択"
            />
          </label>

          <div className={styles["button-group"]}>
            <button
              onClick={() => handleSearch(true)}
              className="light_blue_button"
            >
              指定月
            </button>
            <button
              onClick={() => handleSearch(false)}
              className="light_blue_button"
            >
              指定日
            </button>
          </div>
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
                  <tr key={item.id}>
                    <td>{item.work_day2} ({getDayOfWeek(item.work_day2)})</td>
                    <td>{formatTyoku(item.tyoku2)}</td>
                    <td className={item.judgement ? styles["status-ok"] : styles["status-ng"]}>
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    <td>
                      <Link to={`/kosu-update/${item.id}`} className={styles["a-collar"]}>編集</Link>
                    </td>
                    <td>
                      <Link to={`/kosu-delete/${item.id}`} className={styles["a-collar"]}>削除</Link>
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