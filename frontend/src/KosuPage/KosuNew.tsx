import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Loading from "../components/Loading";
import TyokuSelect from "../components/TyokuSelect";
import WorkSelect from "../components/WorkSelect";
import DefSelect from "../components/DefSelect";
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
  judgement: boolean;
  break_change: boolean;
}

interface DefData {
  [key: string]: string | undefined;
}

const roundToNearestFiveMinutes = (date: Date): Date => {
  const msPerMinute = 60000;
  const minutes = Math.floor(date.getMinutes() / 5) * 5;
  const roundedDate = new Date(Math.floor(date.getTime() / msPerMinute) * msPerMinute);
  roundedDate.setMinutes(minutes);
  return roundedDate;
};

const KosuNew: React.FC = () => {
  const [data, setData] = useState<Kosu | null>(null);
  const [defData, setDefData] = useState<DefData>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>("");

  const [selectedTime1, setSelectedTime1] = useState<Date | null>(() => {
    const cachedTime1 = localStorage.getItem("time1");
    const cachedTime2 = localStorage.getItem("time2");
    return cachedTime1 && cachedTime2 ? new Date(cachedTime2) : roundToNearestFiveMinutes(new Date());
  });
  const [selectedTime2, setSelectedTime2] = useState<Date | null>(() => {
    const cachedTime2 = localStorage.getItem("time2");
    return cachedTime2 ? new Date(cachedTime2) : roundToNearestFiveMinutes(new Date());
  });

  // time1 と time2 のキャッシュ管理のための関数を追加
  const updateCachedTimes = (time1: Date | null, time2: Date | null) => {
    if (time1) localStorage.setItem("time1", time1.toISOString());
    if (time2) localStorage.setItem("time2", time2.toISOString());
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, { withCredentials: true })
      .then((response) => {
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
        });

        const def_data = response.data.def_data || {};
        setDefData(def_data);

        const member_data = response.data.member_data;
        if (member_data?.name) {
          setMemberName(member_data.name);
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        setErrorMessage("データの取得に失敗しました。");
        setLoading(false);
      });
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (data) {
      setData({ ...data, [name]: value });

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

            if (error.response && error.response.data && error.response.data.error) {
              setErrorMessage(error.response.data.error); 
            } else {
              setErrorMessage("日付切り替えで想定外のエラーが発生しました。");
            }
          });
      }
    }
  };

  const handleTimeChange1 = (newTime: Date | null) => {
    setSelectedTime1(newTime);
  };

  const handleTimeChange2 = (newTime: Date | null) => {
    setSelectedTime2(newTime);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;

    const formattedTime1 = selectedTime1?.toISOString();
    const formattedTime2 = selectedTime2?.toISOString();
    const isTomorrowChecked = (document.getElementById("tomorrow_check") as HTMLInputElement)?.checked;
    const overTime = data.over_time || 0;

    if (!data.work_time || !data.tyoku2 || !data.time_work || !formattedTime1 || !formattedTime2) {
      setErrorMessage("入力必要項目が入力されていません");
      return;
    }

    if (formattedTime1 === formattedTime2) {
      setErrorMessage("作業時間が誤っています。確認して下さい。");
      return;
    }
    if (selectedTime1 && selectedTime2 && selectedTime1 > selectedTime2 && !isTomorrowChecked) {
      setErrorMessage("作業開始時間が終了時間を越えています。翌日チェックを忘れていませんか？");
      return;
    }
    if (selectedTime1 && selectedTime2) {
      const timeDifference = Math.abs(selectedTime2.getTime() - selectedTime1.getTime());
      const hoursDifference = timeDifference / (1000 * 60 * 60);
      if (hoursDifference > 21) {
        setErrorMessage("作業時間が21時間を超えています。入力できません。");
        return;
      }
    }
    if (selectedTime1 && selectedTime2 && selectedTime1 < selectedTime2 && isTomorrowChecked) {
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

    const updatedData = {
      ...data,
      time1: formattedTime1,
      time2: formattedTime2,
    };

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, updatedData, { withCredentials: true })
      .then(() => {
        alert("更新が成功しました！");
        updateCachedTimes(selectedTime1, selectedTime2);

        if (formattedTime2) {
          setSelectedTime1(new Date(formattedTime2));
          setSelectedTime2(roundToNearestFiveMinutes(new Date(formattedTime2)));
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
      
        if (error.response && error.response.data && error.response.data.error) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage("更新に失敗しました。再試行してください。");
        }
      });
  };

  return (
    <>
      <Loading isLoading={loading} />
      <form onSubmit={handleSubmit} className={styles["kosu-form"]}>

        <h1 className={styles["h1-collar"]}>{memberName}の工数入力</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>

        {errorMessage && (
          <div role="alert">{errorMessage}</div>
        )}

        <div>
          <label htmlFor="work_day2">就業日:</label>
          <input
            type="date"
            id="work_day2"
            name="work_day2"
            value={data?.work_day2 || ""}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="work_time">勤務:</label>
          <WorkSelect value={data?.work_time || ""} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="tyoku2">直:</label>
          <TyokuSelect value={data?.tyoku2 || ""} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="time_work">作業内容:</label>
          <DefSelect value={data?.time_work || ""} onChange={handleChange} defData={defData} />
        </div>
        <div>
          <label htmlFor="detail_work">作業詳細:</label>
          <textarea
            id="detail_work"
            name="detail_work"
            value={data?.detail_work || ""}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="over_time">残業時間:</label>
          <input
            type="number"
            id="over_time"
            name="over_time"
            value={data?.over_time || 0}
            onChange={handleChange}
          />
        </div>
        <div>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <label htmlFor="time1">開始時間:</label>
            <MobileTimePicker
              value={selectedTime1}
              onChange={handleTimeChange1}
              ampm={false}
              minutesStep={5}
              onAccept={() => {
                const rootElement = document.getElementById("root");
                if (rootElement) rootElement.removeAttribute("aria-hidden");
              }}
            />
          </LocalizationProvider>
        </div>
        <div>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <label htmlFor="time2">終了時間:</label>
            <MobileTimePicker
              value={selectedTime2}
              onChange={handleTimeChange2}
              ampm={false}
              minutesStep={5}
              onAccept={() => {
                const rootElement = document.getElementById("root");
                if (rootElement) rootElement.removeAttribute("aria-hidden");
              }}
            />
          </LocalizationProvider>
        </div>
        <div>
          <label htmlFor="tomorrow_check"></label>
          <input
            type="checkbox"
            id="tomorrow_check"
            name="tomorrow_check"
            onChange={handleChange}
          />
        </div>
        <button type="submit">更新</button>
      </form>
    </>
  );
};

export default KosuNew;