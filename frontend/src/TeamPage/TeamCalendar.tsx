import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/TeamPage/TeamCalendar.module.css";

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

const TeamCalendar: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const [searchDays, setSearchDays] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<[number, string][]>([]);
  const [kosuMap, setKosuMap] = useState<KosuMap>({});
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  const getNearestSunday = (dateString: string): Date => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - date.getDay());
    return date;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/team_calendar/`, { withCredentials: true })
      .then((response) => {
        const results = response.data.kosu_data || [];
        const searchDayString: string = response.data.Search_day;
        const memberNameList: [number, string][] = response.data.member_name_list || [];
        setMemberNames(memberNameList);

        if (searchDayString) {
          setSelectedDay(searchDayString);

          const sunday = getNearestSunday(searchDayString);
          const sevenDays: string[] = [];

          for (let i = 0; i < 7; i++) {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + i);

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            sevenDays.push(`${year}-${month}-${day}`);
          }
          setSearchDays(sevenDays);
        }

        const newKosuMap: KosuMap = results.reduce((acc: KosuMap, item: Kosu) => {
          acc[`${item.employee_no3}_${item.work_day2}`] = item;
          return acc;
        }, {});
        setKosuMap(newKosuMap);
        setData(results);
      })
      .catch((err) => {
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
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const postData = async (day: string) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/team_calendar/`,
        { day: day },
        { withCredentials: true }
      );

      await fetchData(); 
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 404) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(`POSTエラー: ${err.message}`);
        }
      } else {
        setError("予期しないPOSTエラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWeekJump = async (direction: 'B' | 'A') => {
    setLoading(true);
    setError(null);
    const errorPrefix = direction === 'B' ? '前週移動エラー' : '次週移動エラー';
    
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/team_calendar_week_jump/`,
        { week: direction },
        { withCredentials: true }
      );

      await fetchData(); 
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 404) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(`${errorPrefix}: ${err.message}`);
        }
      } else {
        setError(`予期しない${errorPrefix}が発生しました`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedDay) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/team_export/`,
        { day: selectedDay },
        { 
          withCredentials: true,
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const filename = `班員の${selectedDay.substring(0, 7)}月度工数.xlsx`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(`Excel出力エラー: ${err.message}`);
      } else {
        setError("予期しないExcel出力エラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedDay(e.target.value);
  };

  const handleSubmit = () => {
    if (selectedDay) {
      postData(selectedDay);
    }
  };

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

  const formatTimeWork = (timeWorkString: string) => {
    const timeRanges: string[] = [];
    let start = -1;
    let inTimeBlock = false;

    if (timeWorkString && timeWorkString.length === 288) {
      for (let i = 0; i < timeWorkString.length; i++) {
        if (timeWorkString[i] !== '#' && !inTimeBlock) {
          start = i;
          inTimeBlock = true;
        } else if (timeWorkString[i] === '#' && inTimeBlock) {
          const end = i - 1;
          const startHour = Math.floor(start / 12);
          const startMinute = (start % 12) * 5;
          let endHour = Math.floor(end / 12);
          let endMinute = (end % 12) * 5 + 5;

          if (endMinute === 60) {
            endHour++;
            endMinute = 0;
          }

          const startTimeStr = `${String(startHour).padStart(1, '0')}:${String(startMinute).padStart(2, '0')}`;
          const endTimeStr = `${String(endHour).padStart(1, '0')}:${String(endMinute).padStart(2, '0')}`;
          timeRanges.push(`${startTimeStr}～${endTimeStr}`);
          inTimeBlock = false;
          start = -1;
        }
      }

      if (inTimeBlock) {
        const startHour = Math.floor(start / 12);
        const startMinute = (start % 12) * 5;

        const startTimeStr = `${String(startHour).padStart(1, '0')}:${String(startMinute).padStart(2, '0')}`;
        const endTimeStr = '24:00';
        timeRanges.push(`${startTimeStr}～${endTimeStr}`);
      }
    }

    const paddedRanges = timeRanges.slice(0, 4);
    while (paddedRanges.length < 4) {
      paddedRanges.push("　");
    }

    return paddedRanges.map((range, index) => (
      <div key={index}>{range}</div>
    ));
  };

  const displayDate = (dateString: string) => {
    const parts = dateString.split('-');
    return `${parts[1]}/${parts[2]}`;
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["team-calendar-wrapper"]}>
        <h1 className={styles["h1-collar"]}>班員工数入力状況</h1>
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>
        <div className={styles["select-form"]}>
          <div className={styles["select-row"]}>
            <label htmlFor="day">日付選択:</label>
            <input
              type="date"
              id="day"
              name="day"
              value={selectedDay}
              onChange={handleDateChange}
              required
            />
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="orange_button"
            >
              検索
            </button>
          </div>
          <div className={styles["select-row"]}>
            <button 
              type="button"
              onClick={() => handleWeekJump('B')}
              disabled={loading}
              className="orange_button"
            >
              前週
            </button>
            <button 
              type="button"
              onClick={() => handleWeekJump('A')}
              disabled={loading}
              className="orange_button"
            >
              次週
            </button>
          </div>
          <div className={styles["select-row"]}>
            <button 
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="orange_button"
            >
              Excelに出力
            </button>
          </div>
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
                <th colSpan={2} className={styles["th-collar1"]}>曜日</th>
                <th className={styles["th-collar3"]}>日</th>
                <th className={styles["th-collar1"]}>月</th>
                <th className={styles["th-collar1"]}>火</th>
                <th className={styles["th-collar1"]}>水</th>
                <th className={styles["th-collar1"]}>木</th>
                <th className={styles["th-collar1"]}>金</th>
                <th className={styles["th-collar2"]}>土</th>
              </tr>
              <tr>
                <th colSpan={2} className={styles["th-collar1"]}>日付</th>
                {searchDays.map((date, index) => {
                  const className = index === 0 
                    ? styles["th-collar3"] 
                    : index === 6 
                    ? styles["th-collar2"] 
                    : styles["th-collar1"];
                  return (
                    <th key={index} className={className}>
                      {displayDate(date)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {memberNames.map(([employeeNo, name], memberIndex) => (
                <React.Fragment key={employeeNo}>
                  <tr>
                    <td rowSpan={3}>
                      {name}
                    </td>
                    <td>勤務</td>
                    {searchDays.map((date, dayIndex) => {
                      const kosuKey = `${employeeNo}_${date}`;
                      const kosuEntry = kosuMap[kosuKey];
                      const workTime = kosuEntry ? kosuEntry.work_time : '';
                      return (
                        <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                          {workTime}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>残業(分)</td>
                    {searchDays.map((date, dayIndex) => {
                      const kosuKey = `${employeeNo}_${date}`;
                      const kosuEntry = kosuMap[kosuKey];
                      const overTime = kosuEntry ? kosuEntry.over_time : '';
                      return (
                        <td key={dayIndex} style={{ backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '' }}>
                          {overTime}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>入力時間</td>
                    {searchDays.map((date, dayIndex) => {
                      const kosuKey = `${employeeNo}_${date}`;
                      const kosuEntry = kosuMap[kosuKey];
                      const handleCellClick = () => {
                        if (kosuEntry && kosuEntry.id) {
                          navigate(`/team-detail/${kosuEntry.id}`);
                        }
                      };
                      const timeWorkContent = kosuEntry && kosuEntry.time_work
                        ? formatTimeWork(kosuEntry.time_work)
                        : formatTimeWork('');

                      return (
                        <td 
                          key={dayIndex} 
                          className={styles["time-work-cell"]} 
                          style={{ 
                            backgroundColor: kosuEntry?.judgement ? '#ADFF2F' : '',
                            cursor: kosuEntry?.id ? 'pointer' : 'default',
                          }}
                          onClick={handleCellClick}
                        >
                          {timeWorkContent}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default TeamCalendar;