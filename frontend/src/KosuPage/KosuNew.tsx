import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/KosuCalendar.module.css";
import WorkSelect from "../components/WorkSelect";

interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  work_time: string;
  judgement: boolean;
}

const KosuCalendar: React.FC = () => {
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [sessionYear, setSessionYear] = useState<number | null>(null);
  const [sessionMonth, setSessionMonth] = useState<number | null>(null);
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
    } catch (err) {
      // エラー処理
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else if (err.response?.status === 404) {
          navigate("/login");
        } else {
          setError(err.message); // その他のエラーを設定
        }
      } else {
        setError("予期しないエラーが発生しました"); // 予期しないエラーの場合
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

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

    // 前月の空白セルを追加
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarCells.push(null);
    }

    // 今月の日付を追加
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

  // tyoku2の値を日本語に変換する関数
  const getTyoku2Text = (value: string): string => {
    switch (value) {
      case '1':
        return '1直';
      case '2':
        return '2直';
      case '3':
        return '3直';
      case '4':
        return '常昼';
      case '5':
        return '連1直';
      case '6':
        return '連2直';
      default:
        return '';
    }
  };
  
  // WorkSelectのonChangeハンドラ
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // 処理が必要な場合はここに追加
    console.log(e.target.value);
  };


  const calendarRows = sessionYear && sessionMonth ? generateCalendar(sessionYear, sessionMonth) : [];

  // エラー表示
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-calendar-wrapper"]}>
        <h1 className={styles["h1-collar"]}>勤務入力</h1>
        {sessionYear && sessionMonth && (
          <h2>
            {sessionYear}年 {sessionMonth}月
          </h2>
        )}

        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`, // 最大高さ
            overflowY: "auto", // 縦スクロールを有効化
            width: `${tableWidth + 5}px`, // テーブル幅
          }}
        >
          <table ref={tableRef}>
            <thead>
              <tr>
                <th className={styles["th-collar"]}>日</th>
                <th className={styles["th-collar"]}>月</th>
                <th className={styles["th-collar"]}>火</th>
                <th className={styles["th-collar"]}>水</th>
                <th className={styles["th-collar"]}>木</th>
                <th className={styles["th-collar"]}>金</th>
                <th className={styles["th-collar"]}>土</th>
              </tr>
            </thead>
            <tbody>
              {calendarRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((day, colIndex) => {
                    const formattedDay = day !== null ? `${sessionYear}-${String(sessionMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const workDataForDay = formattedDay ? data.find(item => item.work_day2 === formattedDay) : null;

                    return (
                      <td key={colIndex}>
                        {day !== null ? (
                          <div className={styles.dayCell}>
                            {day}
                            <div className={styles.workDataContainer}>
                              <div className={styles.workTimeCell}>
                                <WorkSelect value={workDataForDay?.work_time || ""} onChange={handleChange} />
                              </div>
                              <div className={styles.tyoku2Cell}>
                                {workDataForDay ? getTyoku2Text(workDataForDay.tyoku2) : ''}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.emptyCell}></div>
                        )}
                      </td>
                    );
                  })}
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