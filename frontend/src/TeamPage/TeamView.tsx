import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import ShopSelect from "../components/ShopSelect";
import styles from "../styles/TeamPage/TeamView.module.css";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  work_time: string;
  time_work: string;
  judgement: boolean;
  over_time: string;
}

type KosuMap = {
  [key: string]: Kosu;
};

const TeamView: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [memberNames, setMemberNames] = useState<[number, string][]>([]);
  const [kosuMap, setKosuMap] = useState<KosuMap>({});
  const [sessionYear, setSessionYear] = useState<number | null>(null);
  const [sessionMonth, setSessionMonth] = useState<number | null>(null);
  const [shopDefault, setshopDefault] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/team_view/`, { withCredentials: true });
      const results = response.data.kosu_data || [];
      const memberNameList: [number, string][] = response.data.member_name_list || [];
      setMemberNames(memberNameList);

      const year = response.data.session_year;
      const month = response.data.session_month;
      const shop = response.data.shop_default;
      if (typeof year === 'number' && typeof month === 'number') {
        setSessionYear(year);
        setSessionMonth(month);
      }
      setshopDefault(shop);

      const newKosuMap: KosuMap = results.reduce((acc: KosuMap, item: Kosu) => {
        acc[`${item.employee_no3}_${item.work_day2}`] = item;
        return acc;
      }, {});
      setKosuMap(newKosuMap);
      setData(results);
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

  const postYearMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/team_view/`, {
        year: year,
        month: month,
      }, { withCredentials: true });
      fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  }, [fetchData, navigate]);

  const postShopSelect = useCallback(async (shopValue: string) => {
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/team_shop_select/`, 
        { shop_default: shopValue }, 
        { withCredentials: true }
      );
      fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  }, [fetchData, navigate]);

  const handleShopChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const shop = e.target.value;
    setshopDefault(shop);
    postShopSelect(shop);
  }, [postShopSelect]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight);
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

  const generateDatesAndWeekdays = (year: number, month: number) => {
    const dateList: { day: number, weekday: string, fullDate: string }[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const weekday = weekdays[date.getDay()];
      const fullDate = [
        year,
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0'),
      ].join('-');

      dateList.push({ day, weekday, fullDate });
    }
    return dateList;
  };

  const datesAndWeekdays = (sessionYear && sessionMonth) ? generateDatesAndWeekdays(sessionYear, sessionMonth) : [];

  const getThCollarClass = (weekday: string) => {
    if (weekday === "土") {
      return styles["th-collar2"];
    }
    if (weekday === "日") {
      return styles["th-collar3"];
    }
    return styles["th-collar1"];
  };

  const handleYearMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "year" && sessionMonth !== null) {
      postYearMonth(Number(value), sessionMonth);
    } else if (name === "month" && sessionYear !== null) {
      postYearMonth(sessionYear, Number(value));
    }
  };

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["team-view-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数入力状況(全体)</h1>
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>
        <div className={styles["year-month-selector"]}>
          <select
            name="year"
            value={sessionYear || ""}
            onChange={handleYearMonthChange}
          >
            {getYears().map(year => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
          <select
            name="month"
            value={sessionMonth || ""}
            onChange={handleYearMonthChange}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}月
              </option>
            ))}
          </select>
        </div>
        <div className={styles["shop-select-container"]}>
          <ShopSelect
            id="shop-select-1"
            name="shop1"
            value={shopDefault || ""}
            onChange={handleShopChange}
          />
        </div>
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
                <th rowSpan={2} className={styles["th-collar1"]}>氏名</th>
                {datesAndWeekdays.map((item, index) => (
                  <th 
                    key={`day-${index}`} 
                    className={getThCollarClass(item.weekday)}
                  >
                    {item.day}
                  </th>
                ))}
              </tr>
              <tr>
                {datesAndWeekdays.map((item, index) => {
                  return (
                    <th 
                      key={`weekday-${index}`} 
                      className={getThCollarClass(item.weekday)}
                    >
                      {item.weekday}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {memberNames.map(([employeeNo, name], memberIndex) => {
                return (
                  <React.Fragment key={employeeNo}>
                    <tr>
                      <td>
                        {name}
                      </td>
                      {datesAndWeekdays.map((dateItem, dayIndex) => {
                        const kosuKey = `${employeeNo}_${dateItem.fullDate}`; 
                        const kosuEntry = kosuMap[kosuKey];
                        return (
                          <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                            {kosuEntry ? (kosuEntry.judgement ? "OK" : "NG") : "NG"}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default TeamView;