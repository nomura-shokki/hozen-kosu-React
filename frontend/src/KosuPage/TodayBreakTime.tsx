import React, { useState, useEffect, FormEvent } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/TodayBreakTime.module.css";

interface Kosu {
  employee_no3: number;
  work_day2: string;
  breaktime: string | null;
  breaktime_over1: string | null;
  breaktime_over2: string | null;
  breaktime_over3: string | null;
}

const TodayBreakTime: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakTime1, setBreakTime1] = useState<Date | null>(null);
  const [breakTime2, setBreakTime2] = useState<Date | null>(null);
  const [breakTime3, setBreakTime3] = useState<Date | null>(null);
  const [breakTime4, setBreakTime4] = useState<Date | null>(null);
  const [breakTime5, setBreakTime5] = useState<Date | null>(null);
  const [breakTime6, setBreakTime6] = useState<Date | null>(null);
  const [breakTime7, setBreakTime7] = useState<Date | null>(null);
  const [breakTime8, setBreakTime8] = useState<Date | null>(null);
  const [sessionDay, setSessionDay] = useState<string | null>(null);
  const navigate = useNavigate();

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
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/today_break_time/`, { withCredentials: true })
      .then((response) => {
        const kosu_data: Kosu = response.data.kosu_data || {
          employee_no3: 0,
          breaktime: "#00000000",
          breaktime_over1: "#00000000",
          breaktime_over2: "#00000000",
          breaktime_over3: "#00000000",
        };

        const [initialTime1, initialTime2] = parseBreakTime(kosu_data.breaktime);
        setBreakTime1(initialTime1);
        setBreakTime2(initialTime2);

        const [initialTime3, initialTime4] = parseBreakTime(kosu_data.breaktime_over1);
        setBreakTime3(initialTime3);
        setBreakTime4(initialTime4);

        const [initialTime5, initialTime6] = parseBreakTime(kosu_data.breaktime_over2);
        setBreakTime5(initialTime5);
        setBreakTime6(initialTime6);

        const [initialTime7, initialTime8] = parseBreakTime(kosu_data.breaktime_over3);
        setBreakTime7(initialTime7);
        setBreakTime8(initialTime8);

        setSessionDay(response.data.session_day || null);

        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        handleError(error, "データの取得で想定外のエラーが発生しました");
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    axios
    .post(
      `${process.env.REACT_APP_API_BASE_URL}/api/today_break_time/`,
      {
        breakTime1: breakTime1 ? breakTime1.toISOString() : null,
        breakTime2: breakTime2 ? breakTime2.toISOString() : null,
        breakTime3: breakTime3 ? breakTime3.toISOString() : null,
        breakTime4: breakTime4 ? breakTime4.toISOString() : null,
        breakTime5: breakTime5 ? breakTime5.toISOString() : null,
        breakTime6: breakTime6 ? breakTime6.toISOString() : null,
        breakTime7: breakTime7 ? breakTime7.toISOString() : null,
        breakTime8: breakTime8 ? breakTime8.toISOString() : null,
        sessionDay: sessionDay,
      },
      { withCredentials: true }
    )
    .then(() => {
      alert("変更完了！");
      navigate("/kosu-new");
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
      <div className={styles["today-brea-time-wrapper"]}>
        <h1 className={styles["h1-collar"]}>
          {sessionDay ? new Date(sessionDay).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).replace(/\//g, "年").replace(/月/, "月") + "日" : ""}<br />
          休憩時間変更
        </h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-new">工数入力</Link>
        </nav>
        <p>
          指定した休憩時間に入っている工数は<br />
          休憩時間に置き換わり消えます
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
            <label>昼休憩:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime1}
                  onChange={(newValue) => setBreakTime1(newValue)}
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
                  value={breakTime2}
                  onChange={(newValue) => setBreakTime2(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <label>残業休憩1:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime3}
                  onChange={(newValue) => setBreakTime3(newValue)}
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
                  value={breakTime4}
                  onChange={(newValue) => setBreakTime4(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <label>残業休憩2:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime5}
                  onChange={(newValue) => setBreakTime5(newValue)}
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
                  value={breakTime6}
                  onChange={(newValue) => setBreakTime6(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <label>残業休憩3:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime7}
                  onChange={(newValue) => setBreakTime7(newValue)}
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
                  value={breakTime8}
                  onChange={(newValue) => setBreakTime8(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <button type="submit" className="light_blue_button">登録</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TodayBreakTime;