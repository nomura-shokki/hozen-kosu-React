import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TeamMemberSelect from "../Components/TeamMemberSelect";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/TeamPage/TeamList.module.css";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  judgement: boolean;
}

interface TeamMember {
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
  return days[date.getDay()] || "";
};

const TeamList: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const searchDayRef = useRef<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [teamMemberOptions, setTeamMemberOptions] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
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
      const response = await api.get("/api/team_list/", {
        params: {
          page: page,
          ...(day && {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
          }),
          ...(selectedMember && {
            member_id: selectedMember,
          }),
        }
      });

      const paginationData = response.data?.pagination_data || {};
      const results = paginationData.results || [];
      const pageSize = paginationData.page_size || 20;
      const memberOptions = response.data?.team_member_select || [];

      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: TeamMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      const transformedData = results.map((item: Kosu) => ({
        ...item,
        name: memberNameMap[item.employee_no3] || `Unknown (${item.employee_no3})`,
      }));

      setData(transformedData);
      setTeamMemberOptions(memberOptions);
      setTotalPages(Math.ceil(paginationData.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else if (err.response?.status === 400)
          navigate("/team-menu", { state: { errorMessage: err.response?.data.message } });
        else setError(err.response?.data.message);
      } else {
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedMember]);

  useEffect(() => {
    searchDayRef.current = "";
    const input = document.getElementById("search-day-input") as HTMLInputElement;
    if (input) input.value = "";
    setSearchByMonth(false);
    setCurrentPage(1);
    setSelectedMember("");
  }, [location.pathname]);

  useEffect(() => {
    fetchData(currentPage, searchDayRef.current, searchByMonth);
  }, [currentPage, fetchData, searchByMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMember]);

  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
    fetchData(1, searchDayRef.current, isMonthSearch);
  };

  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMember(event.target.value);
    setCurrentPage(1);
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["team-list-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          班員工数履歴
        </h1>

        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
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
              className="orange_button"
            >
              指定月
            </button>
            <button
              onClick={() => handleSearch(false)}
              className="orange_button"
            >
              指定日
            </button>
          </div>
        </div>

        <div className={styles["search-bar"]}>
          <label htmlFor="team-member-select"></label>
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMember}
            onChange={handleMemberChange}
            options={teamMemberOptions}
          />
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
                  <th className={styles["th-collar"]}>班員</th>
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>詳細</th>
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
                      <Link
                        to={`/team-detail/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        詳細
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
              buttonColor="#f50"
              hoverColor="#f10"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};

export default TeamList;