import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/KosuCalendar.module.css";
import WorkSelect from "../components/WorkSelect";
import TyokuSelect from "../components/TyokuSelect";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  work_time: string;
  time_work: string;
  judgement: boolean;
}

const KosuCalendar: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPostingWorkWrite, setIsPostingWorkWrite] = useState<boolean>(false);
  const [isPostingWorkDefault, setIsPostingWorkDefault] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [sessionYear, setSessionYear] = useState<number | null>(null);
  const [sessionMonth, setSessionMonth] = useState<number | null>(null);
  const [formData, setFormData] = useState<{ [key: string]: { work_time: string; tyoku2: string; week?: string } }>({});
  const [defaultTyokuValues, setDefaultTyokuValues] = useState<string[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate();

  // データを取得する関数
  const fetchData = useCallback(async () => {
    setLoading(true); // ローディング状態を開始
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_calendar/`, { withCredentials: true });

      // レスポンスデータを構造的に処理
      const results = response.data.kosu_data || [];
      setData(results);
      setSessionYear(response.data.session_year);
      setSessionMonth(response.data.session_month);
      const initialFormData: { [key: string]: { work_time: string; tyoku2: string } } = {}; // weekを削除
      results.forEach((item: Kosu) => {
        initialFormData[item.work_day2] = {
          work_time: item.work_time,
          tyoku2: item.tyoku2,
        };
      });
      setFormData(initialFormData);
      setDefaultTyokuValues([]);
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

  const handleChange = (day: string, field: 'work_time' | 'tyoku2', value: string) => {
    setFormData(prevFormData => ({
      ...prevFormData,
      [day]: {
        ...prevFormData[day],
        [field]: value,
      },
    }));
  };
  
  const handleTyokuDefaultChange = (rowIndex: number, value: string) => {
    setDefaultTyokuValues(prevValues => {
      const newValues = [...prevValues];
      newValues[rowIndex] = value;
      return newValues;
    });
  };

  // 年と月をPOSTしてデータを再取得する関数
  const postYearMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_calendar_change/`, {
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

  const postWorkWrite = async () => {
    setIsPostingWorkWrite(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_work_write/`, formData, { withCredentials: true });
      console.log("Post successful:", response.data);
      fetchData(); // 成功時にデータを再取得
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
      setIsPostingWorkWrite(false);
    }
  };

  const postWorkDefault = async () => {
    setIsPostingWorkDefault(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/work_default/`, {}, { withCredentials: true });
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
      setIsPostingWorkDefault(false);
    }
  };

  const handleDefaultTyokuPost = async () => {
    try {
      // 修正: 配列をオブジェクトに変換
      const postData: { [key: string]: string } = defaultTyokuValues.reduce((acc: { [key: string]: string }, tyoku, index) => {
        acc[`default_tyoku${index + 1}`] = tyoku;
        return acc;
      }, {});
  
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/tyoku_default/`, postData, { withCredentials: true });
      fetchData(); // 成功時にデータを再取得
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
    }
  };


  // dayをクリックした際にPOSTする新しい関数
  const handleDayClick = async (dayValue: string) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_link/`, {
        day: dayValue,
      }, { withCredentials: true });
      navigate("/kosu-new");
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
    }
  };

  // コンポーネントマウント時に fetchData を実行
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

  // カレンダーの日付データを生成する関数
  const generateCalendar = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const calendarCells: (number | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarCells.push(null);
    }

    for (let i = 1; i <= totalDaysInMonth; i++) {
      calendarCells.push(i);
    }

    const rows: (number | null)[][] = [];
    let currentRow: (number | null)[] = [];

    calendarCells.forEach((cell, index) => {
      currentRow.push(cell);
      if (currentRow.length === 7 || index === calendarCells.length - 1) {
        rows.push(currentRow);
        currentRow = [];
      }
    });

    return rows;
  };

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

    // 常に4行表示するように調整
    const paddedRanges = timeRanges.slice(0, 4);
    while (paddedRanges.length < 4) {
      paddedRanges.push("　");
    }

    return paddedRanges.map((range, index) => (
      <div key={index}>{range}</div>
    ));
  };

  // 年と月のフォーム変更ハンドラー
  const handleYearMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "year" && sessionMonth !== null) {
      postYearMonth(Number(value), sessionMonth);
    } else if (name === "month" && sessionYear !== null) {
      postYearMonth(sessionYear, Number(value));
    }
  };

  // 年の選択肢を生成
  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  const calendarRows = sessionYear && sessionMonth ? generateCalendar(sessionYear, sessionMonth) : [];

  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-calendar-wrapper"]}>
        <h1 className={styles["h1-collar"]}>勤務入力</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
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
        <div className={styles["button-wrapper"]}>
          <button
            onClick={postWorkWrite}
            disabled={isPostingWorkWrite}
            className="light_blue_button"
          >
            {isPostingWorkWrite ? '送信中...' : '勤務登録'}
          </button>
          
          <button
            onClick={postWorkDefault}
            disabled={isPostingWorkDefault}
            className="light_blue_button"
          >
            標準勤務登録
          </button>
          
          <button
            onClick={handleDefaultTyokuPost}
            className="light_blue_button"
          >
            直一括入力
          </button>
        </div>

        <p>※日付を押すと該当日の工数入力画面に遷移します。</p>
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            width: `${tableWidth + 5}px`,
          }}
        >
          <table ref={tableRef}>
            <thead>
              <tr>
                <th className={styles["th-collar3"]}>日</th>
                <th className={styles["th-collar1"]}>月</th>
                <th className={styles["th-collar1"]}>火</th>
                <th className={styles["th-collar1"]}>水</th>
                <th className={styles["th-collar1"]}>木</th>
                <th className={styles["th-collar1"]}>金</th>
                <th className={styles["th-collar2"]}>土</th>
                <th className={styles["th-collar1"]}>直一括</th>
              </tr>
            </thead>
            <tbody>
              {calendarRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((day, colIndex) => {
                    const formattedDay = day !== null ? `${sessionYear}-${String(sessionMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const dayData = formattedDay ? data.find(item => item.work_day2 === formattedDay) : null;
                    const formDataForDay = formattedDay ? formData[formattedDay] || { work_time: "", tyoku2: "" } : null;

                    return (
                      <td
                        key={colIndex}
                        style={{ backgroundColor: dayData?.judgement ? '#ADFF2F' : '' }}
                      >
                        {day !== null ? (
                          <div>
                            <div onClick={() => handleDayClick(formattedDay!)}>
                                {day}
                            </div>
                            <div>
                              <div className={styles["work-tyoku"]}>
                                <WorkSelect
                                  id={`work_time-${day}`}
                                  value={formDataForDay?.work_time || ""}
                                  onChange={(e) => handleChange(formattedDay!, 'work_time', e.target.value)}
                                  mode='ALL'
                                />
                              </div>
                              <div className={styles["work-tyoku"]}>
                                <TyokuSelect
                                  id={`tyoku-${day}`}
                                  value={formDataForDay?.tyoku2 || ""}
                                  onChange={(e) => handleChange(formattedDay!, 'tyoku2', e.target.value)}
                                />
                              </div>
                              <div>
                                {formatTimeWork(dayData ? dayData.time_work : "")}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div></div>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <div className={styles["work-tyoku"]}>
                      <TyokuSelect
                        id={`tyoku-default-${rowIndex}`}
                        value={defaultTyokuValues[rowIndex] || ""}
                        onChange={(e) => handleTyokuDefaultChange(rowIndex, e.target.value)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default KosuCalendar;