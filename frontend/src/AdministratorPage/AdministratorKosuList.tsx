import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import TeamMemberSelect from "../components/TeamMemberSelect";
import styles from "../styles/AdministratorPage/AdministratorKosuList.module.css";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  judgement: boolean;
}

interface KosuMember {
  id: number;
  employee_no: number;
  name: string;
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

const AdministratorKosuList: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [MemberOptions, setMemberOptions] = useState<KosuMember[]>([]);
  const [selectedMemberInput, setSelectedMemberInput] = useState<string>("");
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

  const fetchData = useCallback(async (
    page: number, 
    day: string, 
    mode: boolean,
    member: string,
  ) => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/manager_kosu/`, {
        params: {
          page: page,
          ...(day && {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
            member: member,
          }),
        },
        withCredentials: true,
      });

      const kosuData = response.data?.kosu_data || {};
      const results = kosuData.results || [];
      const count = kosuData.count || 0;
      const pageSize = results.length > 0 ? count / Math.ceil(count / results.length) : 20;
      const memberOptions = response.data?.member_data || [];
      setTotalPages(Math.ceil(count / pageSize));

      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: KosuMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      const transformedData = results.map((item: Kosu) => ({
        ...item,
        name: memberNameMap[item.employee_no3] || `Unknown (${item.employee_no3})`,
      }));
      setData(transformedData);
      setMemberOptions(memberOptions);
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
  }, [navigate]); 

  useEffect(() => {
    setSearchDay("");
    setSelectedMemberInput("");
    setSearchByMonth(false);
    setCurrentPage(1);
  }, [location.pathname]);

  useEffect(() => {
    fetchData(currentPage, searchDay, searchByMonth, selectedMemberInput);
  }, [currentPage, fetchData]);


  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
    fetchData(1, searchDay, isMonthSearch, ""); 
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

  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMemberInput(event.target.value);
  };

  useEffect(() => {
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(`.${styles["search-bar"]}`) as HTMLElement)?.offsetHeight || 0; 
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
      <div className={styles["admin-kosu-wrapper"]}>
        <h1 className={styles["h1-collar"]}>全工数管理</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
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
          <label htmlFor="team-member-select"></label>
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMemberInput}
            onChange={handleMemberChange}
            options={MemberOptions}
          />

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
                  <th className={styles["th-collar"]}>氏名</th>
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
                    <td>{item.name}</td>
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

export default AdministratorKosuList;