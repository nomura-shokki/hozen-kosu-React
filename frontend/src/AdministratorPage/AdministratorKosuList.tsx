import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import TeamMemberSelect from "../Components/TeamMemberSelect";
import ShopSelect from "../Components/ShopSelect";
import TyokuSelect from "../Components/TyokuSelect";
import WorkSelect from "../Components/WorkSelect";
import JudgementSelect from "../Components/JudgementSelect";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/AdministratorPage/AdministratorKosuList.module.css";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  work_time: string;
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
  return days[date.getDay()] || "";
};

const AdministratorKosuList: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [MemberOptions, setMemberOptions] = useState<KosuMember[]>([]);
  const [selectedMemberInput, setSelectedMemberInput] = useState<string>("");
  const [searchShop, setSearchShop] = useState<string>("");
  const [searchTyoku, setSearchTyoku] = useState<string>("");
  const [searchWork, setSearchWork] = useState<string>("");
  const [searchJudgement, setSearchJudgement] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDay, setSearchDay] = useState<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const navigate = useNavigate();

  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  const fetchData = useCallback(async (
    page: number,
    day: string,
    mode: boolean,
    member: string,
    shop: string,
    tyoku: string,
    work: string,
    judgement: string,
  ) => {
    setLoading(true);
    try {
      const response = await api.get("/api/manager_kosu/", {
        params: {
          page: page,
          ...(day || member || shop || tyoku || work || judgement ? {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
            member: member,
            shop: shop,
            tyoku: tyoku,
            work: work,
            judgement: judgement,
          } : {}),
        }
      });

      const kosuData = response.data?.kosu_data || {};
      const results = kosuData.results || [];
      const pageSize = kosuData.page_size || 20;
      const memberOptions = response.data?.member_data || [];

      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: KosuMember) => {
        memberNameMap[member.employee_no] = member.name;
      });
      const transformedData = results.map((item: Kosu) => ({
        ...item,
        name: memberNameMap[item.employee_no3] || `Unknown (${item.employee_no3})`,
      }));

      setTotalPages(Math.ceil(kosuData.count / pageSize));
      setData(transformedData);
      setMemberOptions(memberOptions);
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
  }, [navigate]);

  useEffect(() => {
    fetchData(
      currentPage,
      searchDay,
      searchByMonth,
      selectedMemberInput,
      searchShop,
      searchTyoku,
      searchWork,
      searchJudgement
    );
  }, [
    currentPage,
    fetchData,
    searchDay,
    searchByMonth,
    selectedMemberInput,
    searchShop,
    searchTyoku,
    searchWork,
    searchJudgement
  ]);

  const handleGenericChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const newValue = event.target.value;
    setter(newValue);
    setCurrentPage(1);
  };

  const handleSearchDayChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleGenericChange(setSearchDay, e);
  };

  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSelectedMemberInput, event);
  };

  const handleShopChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchShop, event);
  };

  const handleTyokuChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchTyoku, event);
  };

  const handleWorkChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchWork, event);
  };

  const handleJudgementChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchJudgement, event);
  };

  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["admin-kosu-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          全工数管理
        </h1>

        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <div className={styles["row-group"]}>
            <div className={styles["form-group"]}>
              <label htmlFor="searchDayInput">就業日：</label>
              <input
                type="date"
                id="searchDayInput"
                value={searchDay}
                onChange={handleSearchDayChange}
                placeholder="日付を選択"
              />
            </div>
            <button onClick={() => handleSearch(true)} className="gray_button">
              指定月
            </button>
            <button onClick={() => handleSearch(false)} className="gray_button">
              指定日
            </button>
          </div>

          <div className={styles["row-group"]}>
            <div className={styles["form-group"]}>
              <label htmlFor="team-member-select">人員：</label>
              <TeamMemberSelect
                id="team-member-select"
                name="team-member-select"
                value={selectedMemberInput}
                onChange={handleMemberChange}
                options={MemberOptions}
              />
            </div>
            <div className={styles["form-group"]}>
              <label htmlFor="shopFilter">ショップ：</label>
              <ShopSelect
                id="shopFilter"
                name="shopFilter"
                value={searchShop}
                onChange={handleShopChange}
              />
            </div>
          </div>

          <div className={styles["row-group"]}>
            <div className={styles["form-group"]}>
              <label htmlFor="tyokuFilter">直：</label>
              <TyokuSelect
                id="tyokuFilter"
                value={searchTyoku}
                onChange={handleTyokuChange}
              />
            </div>
            <div className={styles["form-group"]}>
              <label htmlFor="workFilter">勤務形態：</label>
              <WorkSelect
                id="workFilter"
                value={searchWork}
                onChange={handleWorkChange}
                mode="ALL"
              />
            </div>
          </div>

          <div className={styles["row-group"]}>
            <div className={styles["form-group"]}>
              <label htmlFor="JudgementSelect">整合性:</label>
              <JudgementSelect
                id="JudgementSelect"
                name="JudgementSelect"
                value={searchJudgement}
                onChange={handleJudgementChange}
              />
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <p>No data found.</p>
        ) : (
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
            heightExpansion
          >
            <table>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>氏名</th>
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>勤務形態</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>編集</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.work_day2} ({getDayOfWeek(item.work_day2)})</td>
                    <td>{formatTyoku(item.tyoku2)}</td>
                    <td>{item.work_time}</td>
                    <td className={item.judgement ? styles["status-ok"] : styles["status-ng"]}>
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    <td>
                      <Link
                        to={`/manager-kosu-update/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        編集
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
              buttonColor="#656565"
              hoverColor="#3a3a3a"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};

export default AdministratorKosuList;