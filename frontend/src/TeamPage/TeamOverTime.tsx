import React, { useState, useEffect, useRef, useCallback, FormEvent, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/TeamPage/TeamOverTime.module.css";

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

const TeamOverTime: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [memberNames, setMemberNames] = useState<[number, string][]>([]);
  const [kosuMap, setKosuMap] = useState<KosuMap>({});
  const [sessionYear, setSessionYear] = useState<number | null>(null);
  const [sessionMonth, setSessionMonth] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate();

  // データを取得する関数
  // 引数 forceRefetch を追加し、POST後に強制的に再取得を行うために使用
  const fetchData = useCallback(async () => {
    setLoading(true); // ローディング状態を開始
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/team_overtime/`, { withCredentials: true });

      const results = response.data.kosu_data || [];
      const memberNameList: [number, string][] = response.data.member_name_list || []; // ここで班員名リストを取得
      setMemberNames(memberNameList); // 班員名リストをstateに設定

      const year = response.data.session_year;
      const month = response.data.session_month;
      if (typeof year === 'number' && typeof month === 'number') {
        setSessionYear(year);
        setSessionMonth(month);
      }

      // 取得したKosuデータをマップ形式に変換
      const newKosuMap: KosuMap = results.reduce((acc: KosuMap, item: Kosu) => {
        acc[`${item.employee_no3}_${item.work_day2}`] = item;
        return acc;
      }, {});
      setKosuMap(newKosuMap);
      setData(results);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 404) {
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

  const postYearMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/team_overtime/`, {
        year: year,
        month: month,
      }, { withCredentials: true });
      fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 404) {
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
  }, [fetchData, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight);
    };

    updateMaxHeight();

    // ウィンドウサイズが変更された際にも最大高さを再計算。
    window.addEventListener("resize", updateMaxHeight);

    // コンポーネントがアンマウントされる際にリサイズイベントリスナーを削除し、メモリリークを防ぐ。
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // テーブル幅を更新
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth); // 現在のテーブル幅をセット
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth); // リサイズ時にテーブル幅を再計算
    return () => window.removeEventListener("resize", updateTableWidth); // クリーンアップ
  }, [data]);

  if (error) return <div>Error: {error}</div>;

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

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["team-overtime-wrapper"]}>
        <h1 className={styles["h1-collar"]}>班員工数入力状況</h1>
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
                    className={getThCollarClass(item.weekday)} // 修正箇所
                  >
                    {item.day}
                  </th>
                ))}
                <th rowSpan={2} className={styles["th-collar1"]}>合計</th>
              </tr>
              <tr>
                {datesAndWeekdays.map((item, index) => {
                  return (
                    <th 
                      key={`weekday-${index}`} 
                      className={getThCollarClass(item.weekday)} // 修正箇所
                    >
                      {item.weekday}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {memberNames.map(([employeeNo, name], memberIndex) => {
                let totalOverTimeMinutes = 0;
                return (
                  <React.Fragment key={employeeNo}>
                    <tr>
                      <td>
                        {name}
                      </td>
                      {datesAndWeekdays.map((dateItem, dayIndex) => {
                        const kosuKey = `${employeeNo}_${dateItem.fullDate}`; 
                        const kosuEntry = kosuMap[kosuKey];
                        const overTimeMinutes = kosuEntry && !isNaN(Number(kosuEntry.over_time)) ? Number(kosuEntry.over_time) : 0;
                        totalOverTimeMinutes += overTimeMinutes;
                        const overTimeDisplay = overTimeMinutes > 0 ? (overTimeMinutes / 60).toFixed(2) : "0.00";

                        return (
                          <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                            {overTimeDisplay}
                          </td>
                        );
                      })}
                      <td className={styles["th-total"]}>
                        {
                          totalOverTimeMinutes > 0
                            ? (totalOverTimeMinutes / 60).toFixed(2)
                            : "0.00"
                        }H
                      </td>
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

export default TeamOverTime;