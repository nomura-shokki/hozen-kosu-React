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
  const [data, setData] = useState<Kosu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const [searchDays, setSearchDays] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<[number, string][]>([]);
  const [kosuMap, setKosuMap] = useState<KosuMap>({});
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate();

  // 日付文字列 (YYYY-MM-DD) から Date オブジェクトを作成し、直近の日曜日を計算するヘルパー関数
  const getNearestSunday = (dateString: string): Date => {
    const date = new Date(dateString);
    // getDay() は日曜日を 0、月曜日を 1 ... 土曜日を 6 として返す
    // 日付から現在の日を引いて、日曜日（0）に調整する
    date.setDate(date.getDate() - date.getDay());
    return date;
  };

  // データを取得する関数
  // 引数 forceRefetch を追加し、POST後に強制的に再取得を行うために使用
  const fetchData = useCallback(async () => {
    setLoading(true); // ローディング状態を開始
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/team_calendar/`, { withCredentials: true });

      const results = response.data.kosu_data || [];
      const searchDayString: string = response.data.Search_day; // ここで日付データを取得
      const memberNameList: [number, string][] = response.data.member_name_list || []; // ここで班員名リストを取得
      setMemberNames(memberNameList); // 班員名リストをstateに設定

      // 1. 直近の日曜日を計算
      if (searchDayString) {
        // 検索日で選択した日付のstateを更新
        setSelectedDay(searchDayString);

        const sunday = getNearestSunday(searchDayString);
        const sevenDays: string[] = [];

        // 2. 日曜日から始まる7日間の日付を作成
        for (let i = 0; i < 7; i++) {
          const date = new Date(sunday);
          date.setDate(sunday.getDate() + i);

          // YYYY-MM-DD 形式にフォーマット
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          sevenDays.push(`${year}-${month}-${day}`);
        }
        setSearchDays(sevenDays); // stateに設定
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

  const postData = async (day: string) => {
    setLoading(true); // ローディング状態を開始
    setError(null); // エラーをリセット
    try {
      // 選択された日付を 'day' パラメータとしてPOST
      await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/team_calendar/`,
        { day: day },
        { withCredentials: true }
      );
      
      // POST成功後、GET処理を再度実行
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
    setLoading(true); // ローディング状態を開始
    setError(null); // エラーをリセット
    const errorPrefix = direction === 'B' ? '前週移動エラー' : '次週移動エラー';
    
    try {
      // 'B' (Before: 前週) または 'A' (After: 次週) を week パラメータとしてPOST
      await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/team_calendar_week_jump/`,
        { week: direction }, // 引数 direction を使用
        { withCredentials: true }
      );
      
      // POST成功後、GET処理を再度実行して新しい週のデータを取得
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

  // 日付選択フォームの変更ハンドラ
  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedDay(e.target.value);
  };

  // フォーム送信ハンドラ
  const handleSubmit = () => {
    if (selectedDay) {
      postData(selectedDay);
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


  if (error) return <div>Error: {error}</div>;

  // 日付を表示形式 (MM/DD) に変換するヘルパー関数
  const displayDate = (dateString: string) => {
    const parts = dateString.split('-');
    // YYYY-MM-DD から MM/DD を抽出
    return `${parts[1]}/${parts[2]}`;
  };

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