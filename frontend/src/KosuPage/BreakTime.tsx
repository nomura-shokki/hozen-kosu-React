import React, { useState, useEffect, FormEvent } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/BreakTime.module.css";

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
  break_time1: string | null;
  break_time1_over1: string | null;
  break_time1_over2: string | null;
  break_time1_over3: string | null;
  break_time2: string | null;
  break_time2_over1: string | null;
  break_time2_over2: string | null;
  break_time2_over3: string | null;
  break_time3: string | null;
  break_time3_over1: string | null;
  break_time3_over2: string | null;
  break_time3_over3: string | null;
  break_time4: string | null;
  break_time4_over1: string | null;
  break_time4_over2: string | null;
  break_time4_over3: string | null;
  break_time5: string | null;
  break_time5_over1: string | null;
  break_time5_over2: string | null;
  break_time5_over3: string | null;
  break_time6: string | null;
  break_time6_over1: string | null;
  break_time6_over2: string | null;
  break_time6_over3: string | null;
}

const BreakTime: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakTimes, setBreakTimes] = useState<(Date | null)[]>(Array(48).fill(null));

  const handleError = (error: any, defaultMessage: string) => {
    if (error.response && error.response.data && error.response.data.error) {
      setErrorMessage(error.response.data.error);
    } else {
      setErrorMessage(defaultMessage);
    }
  };

  const parseBreakTime = (breaktime: string | null): [Date | null, Date | null] => {
    const validBreaktime = breaktime || "#00000000"; // nullならデフォルト値適用

    if (validBreaktime.length === 9 && validBreaktime.startsWith("#")) {
      const time1 = new Date();
      const time2 = new Date();

      time1.setHours(parseInt(validBreaktime.slice(1, 3), 10));
      time1.setMinutes(parseInt(validBreaktime.slice(3, 5), 10));
      time1.setSeconds(0);
      time1.setMilliseconds(0);

      time2.setHours(parseInt(validBreaktime.slice(5, 7), 10));
      time2.setMinutes(parseInt(validBreaktime.slice(7, 9), 10));
      time2.setSeconds(0);
      time2.setMilliseconds(0);

      return [time1, time2];
    }
    return [null, null];
  };

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/break_time/`, { withCredentials: true })
      .then((response) => {
        const member_data: Member = response.data.member_data || {};
  
        const breakTimeKeys = [
          "break_time1", "break_time1_over1", "break_time1_over2", "break_time1_over3",
          "break_time2", "break_time2_over1", "break_time2_over2", "break_time2_over3",
          "break_time3", "break_time3_over1", "break_time3_over2", "break_time3_over3",
          "break_time4", "break_time4_over1", "break_time4_over2", "break_time4_over3",
          "break_time5", "break_time5_over1", "break_time5_over2", "break_time5_over3",
          "break_time6", "break_time6_over1", "break_time6_over2", "break_time6_over3",
        ];
  
        const newBreakTimes = breakTimeKeys.flatMap((key) => {
          const breakTimeValue = member_data[key as keyof Member] as string | null;
          return parseBreakTime(breakTimeValue);
        });
  
        setBreakTimes(newBreakTimes);
        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        handleError(error, "データの取得で想定外のエラーが発生しました");
        setLoading(false);
      });
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
  
    const breakTimeData = breakTimes.reduce((result, time, index) => {
      result[`breakTime${index + 1}`] = time ? time.toISOString() : null;
      return result;
    }, {} as { [key: string]: string | null });
  
    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/break_time/`, breakTimeData, {
        withCredentials: true,
      })
      .then(() => {
        alert("変更完了！");
      })
      .catch((error) => {
        console.error(error);
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["brea-time-wrapper"]}>
        <h1 className={styles["h1-collar"]}>
          休憩時間変更
        </h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>
        <p>
          毎日の休憩時間が変更されます<br />
          1日のみの休憩変更は工数入力画面の休憩変更釦から実施
        </p>

        {errorMessage && <div role="alert">{errorMessage}</div>}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              e.target instanceof HTMLInputElement &&
              e.target.type !== "textarea"
            ) {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            {/* 6つの直に対してそれぞれ昼休憩、残業休憩1〜3を表示 */}
            {["1直", "2直", "3直", "常昼", "連1直", "連2直"].map((groupLabel, groupIndex) => (
              <div key={groupLabel} className={styles["breakinition-block"]}>
                <h3>{groupLabel}</h3> {/* ラベルをセクションごとに表示 */}
                {["昼休憩", "残業休憩1", "残業休憩2", "残業休憩3"].map((breakLabel, breakIndex) => (
                  <div key={breakLabel}>
                    <label>{`${breakLabel}`}:</label>
                    <div className={styles["time-picker-wrapper"]}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <MobileTimePicker
                          className={styles["time-picker"]}
                          value={breakTimes[groupIndex * 8 + breakIndex * 2]}
                          onChange={(newValue) => {
                            const updatedBreakTimes = [...breakTimes];
                            updatedBreakTimes[groupIndex * 8 + breakIndex * 2] = newValue;
                            setBreakTimes(updatedBreakTimes);
                          }}
                          ampm={false}
                          minutesStep={5}
                          onAccept={() => {
                            const rootElement = document.getElementById("root");
                            if (rootElement) rootElement.removeAttribute("aria-hidden");
                          }}
                        />
                      </LocalizationProvider>
                      <span>〜</span>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <MobileTimePicker
                          className={styles["time-picker"]}
                          value={breakTimes[groupIndex * 8 + breakIndex * 2 + 1]}
                          onChange={(newValue) => {
                            const updatedBreakTimes = [...breakTimes];
                            updatedBreakTimes[groupIndex * 8 + breakIndex * 2 + 1] = newValue;
                            setBreakTimes(updatedBreakTimes);
                          }}
                          ampm={false}
                          minutesStep={5}
                          onAccept={() => {
                            const rootElement = document.getElementById("root");
                            if (rootElement) rootElement.removeAttribute("aria-hidden");
                          }}
                        />
                      </LocalizationProvider>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {errorMessage && <div role="alert">{errorMessage}</div>}
            <button type="submit" className="light_blue_button">登録</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default BreakTime;