import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
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
  return days[date.getDay()] || "";
};

const KosuList: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const searchDayRef = useRef<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const location = useLocation();
  const navigate = useNavigate();

  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  const fetchData = useCallback(async (
    page: number, 
    day: string, 
    mode: boolean
  ) => {
    setLoading(true);
    try {
      const response = await api.get("/api/kosu_list/", {
        params: {
          page: page,
          ...(day && {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
          })
        }
      });

      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setError(err.response?.data.message);
      } else {
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    searchDayRef.current = "";
    const input = document.getElementById("search-day-input") as HTMLInputElement;
    if (input) input.value = "";
    setSearchByMonth(false);
    setCurrentPage(1);
  }, [location.pathname]);

  useEffect(() => {
    fetchData(currentPage, searchDayRef.current, searchByMonth);
  }, [currentPage, fetchData, searchByMonth]);

  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
    fetchData(1, searchDayRef.current, isMonthSearch); 
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-list-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          工数履歴
        </h1>

        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>

        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label htmlFor="search-day-input"></label>
          <input
            id="search-day-input"
            type="date"
            defaultValue={searchDayRef.current}
            onChange={(e) => { searchDayRef.current = e.target.value; }}
            placeholder="日付を選択"
          />

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
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
          >
            <table>
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
                    <td
                      className={
                        item.judgement
                          ? styles["status-ok"]
                          : styles["status-ng"]
                      }
                    >
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    <td>
                      <Link
                        to={`/kosu-update/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        編集
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/kosu-delete/${item.id}`}
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
              buttonColor="#0ff"
              hoverColor="#0af"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};

export default KosuList;