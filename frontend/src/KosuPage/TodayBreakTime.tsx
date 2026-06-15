import React, { useState, useEffect, FormEvent } from "react";
import api from "../api/axios";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers";
import Loading from "../Components/Loading";
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

  const parseBreakTime = (breaktime: string | null): [Date | null, Date | null] => {
    const validBreaktime = breaktime || "#00000000";

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
    const fetchData = async () => {
      try {
        const response = await api.get("/api/today_break_time/");
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
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else if (err.response?.status === 400) navigate("/kosu-new");
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const breakConfigs = [
      { start: breakTime1, end: breakTime2, label: "昼休憩", limit: 60 },
      { start: breakTime3, end: breakTime4, label: "残業休憩1", limit: 15 },
      { start: breakTime5, end: breakTime6, label: "残業休憩2", limit: 60 },
      { start: breakTime7, end: breakTime8, label: "残業休憩3", limit: 15 },
    ];

    for (const config of breakConfigs) {
      if (config.start && config.end) {
        let diffMin = (config.end.getTime() - config.start.getTime()) / (1000 * 60);

        if (diffMin < 0) {
          diffMin += 24 * 60;
        }

        if (diffMin > config.limit) {
          setErrorMessage(`${config.label}が${config.limit}分を超えています。`);
          return;
        }
      }
    }

    try {
      await api.post("/api/today_break_time/",
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
        }
      );

      const formattedDate = sessionDay
        ? new Date(sessionDay)
            .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
            .replace(/\//g, "年")
            .replace(/月/, "月") + "日"
        : "日付未設定";

      alert(`${formattedDate} 休憩時間変更完了！`);
      navigate("/kosu-new");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  };

  const breakLabels = [
    { label: "昼休憩", start: breakTime1, setStart: setBreakTime1, end: breakTime2, setEnd: setBreakTime2 },
    { label: "残業休憩1", start: breakTime3, setStart: setBreakTime3, end: breakTime4, setEnd: setBreakTime4 },
    { label: "残業休憩2", start: breakTime5, setStart: setBreakTime5, end: breakTime6, setEnd: setBreakTime6 },
    { label: "残業休憩3", start: breakTime7, setStart: setBreakTime7, end: breakTime8, setEnd: setBreakTime8 },
  ];

  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
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

        {errorMessage && <div role="alert" style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</div>}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              {breakLabels.map((item) => (
                <React.Fragment key={item.label}>
                  <label>{item.label}:</label>
                  <div className={styles["time-picker-wrapper"]}>
                    <MobileTimePicker
                      className={styles["time-picker"]}
                      value={item.start}
                      onChange={(newValue) => item.setStart(newValue)}
                      ampm={false}
                      minutesStep={5}
                      onAccept={() => {
                        const rootElement = document.getElementById("root");
                        if (rootElement) rootElement.removeAttribute("aria-hidden");
                      }}
                    />
                    <span>〜</span>
                    <MobileTimePicker
                      className={styles["time-picker"]}
                      value={item.end}
                      onChange={(newValue) => item.setEnd(newValue)}
                      ampm={false}
                      minutesStep={5}
                      onAccept={() => {
                        const rootElement = document.getElementById("root");
                        if (rootElement) rootElement.removeAttribute("aria-hidden");
                      }}
                    />
                  </div>
                </React.Fragment>
              ))}
            </LocalizationProvider>

            {errorMessage && <div role="alert" style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</div>}

            <button type="submit" className="light_blue_button">登録</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TodayBreakTime;