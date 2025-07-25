import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Loading from "../components/Loading";
import TyokuSelect from "../components/TyokuSelect";
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
  const [data, setData] = useState<Kosu | null>(null); // 工数データ
  const [defData, setDefData] = useState<DefData>({}); // 工数区分データ
  const [loading, setLoading] = useState(true); // ローディング状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ
  const [memberName, setMemberName] = useState<string>(""); // Djangoから取得した従業員名

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

        setData(kosu_data);

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

      // 就業日が変更された場合の処理
      if (name === "work_day2") {
        axios
          .post(
            `${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/set_day/`,
            { day: value },
            { withCredentials: true }
          )
          .then(() => {
            fetchData(); // データを再取得
          })
          .catch((error) => {
            console.error("就業日の設定エラー:", error);
            setErrorMessage("就業日の設定に失敗しました。");
          });
      }
    }
  };

  // 開始時間の変更ハンドラー
  const handleTimeChange1 = (newTime: Date | null) => {
    setSelectedTime1(newTime);
  };

  // 終了時間の変更ハンドラー
  const handleTimeChange2 = (newTime: Date | null) => {
    setSelectedTime2(newTime);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;

    // 各時間を ISOフォーマット文字列に変換してデータに追加
    const formattedTime1 = selectedTime1?.toISOString();
    const formattedTime2 = selectedTime2?.toISOString();

    const updatedData = {
      ...data,
      time1: formattedTime1,
      time2: formattedTime2,
    };

    // POSTの成功時にキャッシュの更新を実施
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
          employee_no3: 0,
          work_day2: "",
          tyoku2: "",
          time_work: "",
          detail_work: "",
          over_time: 0,
          work_time: "",
          judgement: false,
          break_change: false,
        });
      })
      .catch((error) => {
        console.error("更新エラー:", error);
        setErrorMessage("更新に失敗しました。再試行してください。");
      });
  };

  if (loading) return <Loading isLoading={loading} />;
  if (errorMessage) return <div>{errorMessage}</div>;

  return (
    <form onSubmit={handleSubmit} className={styles["kosu-form"]}>

      <h1 className={styles["h1-collar"]}>{memberName}の工数入力</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>

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
      <button type="submit">更新</button>
    </form>
  );
};

export default KosuNew;