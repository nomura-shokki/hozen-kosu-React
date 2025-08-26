import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Loading from "../components/Loading";
import TyokuSelect from "../components/TyokuSelect";
import WorkSelect from "../components/WorkSelect";
import DefSelect from "../components/DefSelect";
import KosuDisplay from "../components/KosuDisplay";
import KosuBarChart from "../components/KosuBarChart"; 
import DefTable from "../components/DefTable";
import styles from "../styles/KosuPage/KosuNew.module.css";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";

interface Kosu {
  employee_no3: number;
  work_day2: string;
  tyoku2: string;
  time_work: string;
  detail_work: string;
  over_time: number;
  work_time: string;
  def_ver2: string;
  judgement: boolean;
  break_change: boolean;
}

interface DefData {
  [key: string]: string | undefined;
}

const roundToNearestFiveMinutes = (date: Date, workDay: Date): Date => {
  const minutes = Math.floor(date.getMinutes() / 5) * 5;
  date.setMinutes(minutes, 0, 0);
  date.setFullYear(workDay.getFullYear());
  date.setMonth(workDay.getMonth());
  date.setDate(workDay.getDate());
  return date;
};

const KosuNew: React.FC = () => {
  const [data, setData] = useState<Kosu | null>(null);
  const [defData, setDefData] = useState<DefData>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>("");
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null);
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null);
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null);
  const [memberShop, setMemberShop] = useState<string>("");
  const [isTomorrowChecked, setIsTomorrowChecked] = useState<boolean>(false);
  const [isBreakChangeChecked, setIsBreakChangeChecked] = useState<boolean>(false);
  const [selectedTimes, setSelectedTimes] = useState<{
    time1: Date | null;
    time2: Date | null;
  }>({
    time1: (() => {
      const cachedTime1 = localStorage.getItem("time1");
      const workDay = data ? new Date(data.work_day2) : new Date();
      return cachedTime1 ? new Date(cachedTime1) : roundToNearestFiveMinutes(new Date(), workDay);
    })(),
    time2: (() => {
      const cachedTime2 = localStorage.getItem("time2");
      const workDay = data ? new Date(data.work_day2) : new Date();
      return cachedTime2 ? new Date(cachedTime2) : roundToNearestFiveMinutes(new Date(), workDay);
    })(),
  });

  const handleTimeChange = (
    field: "time1" | "time2",
    newTime: Date | null
  ) => {
    setSelectedTimes((prev) => ({ ...prev, [field]: newTime }));
  };

  const updateCachedTimes = (time1: Date | null, time2: Date | null) => {
    if (time1) localStorage.setItem("time1", time1.toISOString());
    if (time2) localStorage.setItem("time2", time2.toISOString());
  };

  const handleError = useCallback((error: any, defaultMessage: string) => {
    if (error.response && error.response.data && error.response.data.error) {
      setErrorMessage(error.response.data.error);
    } else {
      setErrorMessage(defaultMessage);
    }
  }, []);

  const fetchData = useCallback(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, { withCredentials: true })
      .then((response) => {
        setWarningMessage(response.data.warning || null);
        const kosu_data = response.data.kosu_data || {
          employee_no3: 0,
          work_day2: "",
          tyoku2: "",
          time_work: "",
          detail_work: "",
          over_time: 0,
          work_time: "",
          judgement: false,
          break_change: false,
        };

        const sessionDay = response.data.session_day || "";

        setData({
          ...kosu_data,
          work_day2: sessionDay,
          detail_work: "",
        });

        const def_data = response.data.def_data || {};
        setDefData(def_data);
        const member_data = response.data.member_data;
        if (member_data?.name) {
          setMemberName(member_data.name);
        }
        if (member_data?.shop) {
          setMemberShop(member_data.shop);
        }
        setInitialTimeWork(kosu_data.time_work);
        setInitialWorkDetail(kosu_data.detail_work);
        setInitialTyoku(kosu_data.tyoku2);
        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        handleError(error, "データの取得で想定外のエラーが発生しました");
        setLoading(false);
      });
  }, [handleError]); 

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (data) {
      const updatedValue =
        name === "over_time" ? parseInt(value, 10) || 0 : value;
  
      setData({
        ...data,
        [name]: updatedValue,
      });

      if (name === "work_day2") {
        axios
          .post(
            `${process.env.REACT_APP_API_BASE_URL}/api/set_day/`,
            { day: value || "" },
            { withCredentials: true }
          )
          .then(() => {
            if (value) fetchData();
          })
          .catch((error) => {
            console.error("エラーが発生しました:", error);
            handleError(error, "日付切り替えで想定外のエラーが発生しました");
          });
      }
    }
  };

  const setTime2ToCurrentRounded = () => {
    if (data) {
      const workDay = new Date(data.work_day2);
      const now = roundToNearestFiveMinutes(new Date(), workDay);
      setSelectedTimes((prev) => ({ ...prev, time2: now }));
  
      if (selectedTimes.time1 && now.getTime() < selectedTimes.time1.getTime()) {
        setIsTomorrowChecked(true);
      } else {
        setIsTomorrowChecked(false);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;

    const workDay = new Date(data.work_day2);
    if (selectedTimes.time1) {
      selectedTimes.time1.setFullYear(workDay.getFullYear());
      selectedTimes.time1.setMonth(workDay.getMonth());
      selectedTimes.time1.setDate(workDay.getDate());
    }
    if (selectedTimes.time2) {
      selectedTimes.time2.setFullYear(workDay.getFullYear());
      selectedTimes.time2.setMonth(workDay.getMonth());
      selectedTimes.time2.setDate(workDay.getDate());
    }
  
    const formattedTime1 = selectedTimes.time1?.toISOString();
    const formattedTime2 = selectedTimes.time2?.toISOString();
    const overTime = data.over_time || 0;

    if (!data.work_time || !data.tyoku2 || !data.time_work || !formattedTime1 || !formattedTime2) {
      setErrorMessage("入力必要項目が入力されていません。");
      return;
    }

    if (formattedTime1 === formattedTime2) {
      setErrorMessage("作業時間が誤っています確認して下さい。");
      return;
    }
    if (selectedTimes.time1 && selectedTimes.time2 && selectedTimes.time1 > selectedTimes.time2 && !isTomorrowChecked) {
      setErrorMessage("作業開始時間が終了時間を越えています。翌日チェックを忘れていませんか？");
      return;
    }
    if (selectedTimes.time1 && selectedTimes.time2) {
      const time1Hours = selectedTimes.time1.getHours();
      const time1Minutes = selectedTimes.time1.getMinutes();
      const time2Hours = selectedTimes.time2.getHours();
      const time2Minutes = selectedTimes.time2.getMinutes();
      const time1InMinutes = time1Hours * 60 + time1Minutes;
      const time2InMinutes = time2Hours * 60 + time2Minutes;
      const timeDifference = Math.abs(time2InMinutes - time1InMinutes);
      const hoursDifference = timeDifference / 60;
      if (time1InMinutes < time2InMinutes && hoursDifference > 21 || time1InMinutes > time2InMinutes && hoursDifference < 3) {
        setErrorMessage("作業時間が21時間を超えています。入力できません。");
        return;
      }
    }
    if (selectedTimes.time1 && selectedTimes.time2 && selectedTimes.time1 < selectedTimes.time2 && isTomorrowChecked) {
      setErrorMessage("1日以上の工数は入力できません。誤って翌日チェックを入れていませんか？");
      return;
    }
    if (data.work_time !== "休出" && overTime % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    if (data.work_time === "休出" && overTime % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }
    if (data.detail_work && data.detail_work.length > 100) {
      setErrorMessage("作業詳細は100文字以内にしてください。");
      return;
    }
    if (data.detail_work.includes("$")) {
      setErrorMessage("作業詳細に『$』は使用できません。");
      return;
    }

    const updatedData = {
      ...data,
      over_time: data.over_time || 0,
      time1: formattedTime1,
      time2: formattedTime2,
      tomorrow_check: isTomorrowChecked,
      break_change: isBreakChangeChecked,
    };

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, updatedData, { withCredentials: true })
      .then(() => {
        alert("更新が成功しました！");
        updateCachedTimes(selectedTimes.time1, selectedTimes.time2);
        fetchData();

        if (formattedTime2) {
          const workDay = new Date(data.work_day2);
          setSelectedTimes({ 
            time1: new Date(formattedTime2),
            time2: roundToNearestFiveMinutes(new Date(formattedTime2), workDay),
          });
          localStorage.setItem("time1", formattedTime2);
          localStorage.setItem("time2", formattedTime2);
        }

        setData({
          ...data,
          time_work: "",
          detail_work: "",
          over_time: 0,
          judgement: false,
          break_change: false,
        });
        setErrorMessage(null);
      })
      .catch((error) => {
        console.error("更新エラー:", error);
        handleError(error, "更新に失敗しました。再試行してください。"); // 共通関数を使用
      });
  };

  const handleSendOverTime = () => {
    if (!data) {
      return;
    }
    const overTime = data.over_time || 0;
    if (data.work_time !== "休出" && overTime % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    if (data.work_time === "休出" && overTime % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/over_time/`, data, { withCredentials: true })
      .then(() => {
        alert("残業情報を送信しました！");
      })
      .catch((error) => {
        console.error("残業送信エラー:", error);
        handleError(error, "残業情報送信でエラーが発生しました。");
      });
  };

  const handleIncrement = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) + 15 });
    }
  };
  const handleDecrement = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) - 15 });
    }
  }; 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-new-wrapper"]}>
        <h1 className={styles["h1-collar"]}>{memberName}の工数入力</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>

        {warningMessage && (
          <div role="alert">{warningMessage}</div>
        )}

        {errorMessage && (
          <div role="alert">{errorMessage}</div>
        )}

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
            <label htmlFor="work_day2">就業日:
              <span style={{ color: data?.judgement ? "blue" : "red", marginLeft: "8px" }}>
                {data?.judgement ? "OK" : "NG"}
              </span>
            </label>
            <input
              type="date"
              id="work_day2"
              name="work_day2"
              value={data?.work_day2 || ""}
              onChange={handleChange}
            />

            <label htmlFor="work_time">勤務・直:</label>
            <div className={styles["work-tyoku-wrapper"]}>
              <WorkSelect value={data?.work_time || ""} onChange={handleChange} />
              <TyokuSelect value={data?.tyoku2 || ""} onChange={handleChange} />
            </div>

            <label htmlFor="time_work">
              作業内容：
              <Link to="/def-search" className="green_button">
                工数区分定義確認
              </Link>
            </label>
            <DefSelect value={data?.time_work || ""} onChange={handleChange} defData={defData} />

            <label htmlFor="detail_work">作業詳細:</label>
            <input
              type="text"
              id="detail_work"
              name="detail_work"
              value={data?.detail_work || ""}
              onChange={handleChange}
            />

            <label>
              作業時間:
              <button type="button" onClick={setTime2ToCurrentRounded}  className="light_blue_button">
                現在時刻
              </button>
            </label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={selectedTimes.time1}
                  onChange={(newTime) => handleTimeChange("time1", newTime)}
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
                  value={selectedTimes.time2}
                  onChange={(newTime) => handleTimeChange("time2", newTime)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
              <div>
                <label htmlFor="tomorrow_check">翌日:</label>
                <input
                  type="checkbox"
                  id="tomorrow_check"
                  name="tomorrow_check"
                  checked={isTomorrowChecked}
                  onChange={(e) => setIsTomorrowChecked(e.target.checked)}
                />
              </div>
            </div>

            <label htmlFor="over_time">残業時間:</label>
            <div className={styles["over-time-wrapper"]}>
              <button
                type="button"
                className={styles["custom-button"]}
                onClick={() => handleDecrement("over_time")}
              >
                -
              </button>
              <input
                type="number"
                id="over_time"
                name="over_time"
                value={data?.over_time || 0}
                onChange={handleChange}
              />
              <button
                type="button"
                className={styles["custom-button"]}
                onClick={() => handleIncrement("over_time")}
              >
                +
              </button>
              <button
                type="button"
                onClick={handleSendOverTime}
                className="light_blue_button"
              >
                残業のみ登録
              </button>
            </div>

            <div className={styles["switch-wrapper"]}>
              <label htmlFor="break_change">休憩変更：
                <Link to="/today-break-time" className="light_blue_button">
                  休憩登録
                </Link>
              </label>
              <div
                className={styles["toggle-switch"]}
                onClick={() => setIsBreakChangeChecked(!isBreakChangeChecked)}
              >
                <input
                  type="checkbox"
                  id="break_change"
                  name="break_change"
                  checked={isBreakChangeChecked}
                  onChange={(e) => setIsBreakChangeChecked(e.target.checked)}
                />
                <span className={styles["toggle-slider"]}></span>
              </div>
            </div>

            <button type="submit" className="light_blue_button">更新</button>
          </div>
        </form>
        {initialTimeWork && (
          <div className={styles["centeredContainer"]}>
            <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""}  defData={defData} tyoku={initialTyoku || ""} shop={memberShop || ""}/>
            <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
            <DefTable defData={defData} />
          </div>
        )}
      </div>
    </>
  );
};

export default KosuNew;