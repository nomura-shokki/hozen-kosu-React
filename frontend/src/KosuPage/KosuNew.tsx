import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import Loading from "../components/Loading";
import DefSelect from "../components/DefSelect";
import styles from "../styles/KosuPage/KosuNew.module.css";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";

interface Kosu {
  employee_no3: number;
  work_day2: string;
  tyoku2: string;
  time_work: string; // 作業内容（選択肢）
  detail_work: string;
  over_time: number;
  breaktime: string;
  breaktime_over1: string;
  breaktime_over2: string;
  breaktime_over3: string;
  work_time: string;
  judgement: boolean;
  break_change: boolean;
}

interface DefData {
  [key: string]: string | undefined; // 工数区分データ: 動的なキー（例：kosu_title_1, kosu_title_2, ...）
}

// 現在時刻を5分単位で丸める関数
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

  // 2つの時間選択フォームの状態管理
  const [selectedTime1, setSelectedTime1] = useState<Date | null>(() => {
    const cachedTime1 = localStorage.getItem("time1");
    return cachedTime1 ? new Date(cachedTime1) : roundToNearestFiveMinutes(new Date());
  });
  const [selectedTime2, setSelectedTime2] = useState<Date | null>(() => {
    const cachedTime2 = localStorage.getItem("time2");
    return cachedTime2 ? new Date(cachedTime2) : roundToNearestFiveMinutes(new Date());
  });

  useEffect(() => {
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
          breaktime: "",
          breaktime_over1: "",
          breaktime_over2: "",
          breaktime_over3: "",
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
  }, []);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (data) {
      setData({ ...data, [name]: value });
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

    // time2 の値をキャッシュに保存
    if (formattedTime2) {
      localStorage.setItem("time2", formattedTime2);
    }

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, updatedData, { withCredentials: true })
      .then(() => {
        alert("更新が成功しました！");
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
      <h1>{memberName}の工数入力</h1>

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
        <input
          type="text"
          id="tyoku2"
          name="tyoku2"
          value={data?.tyoku2 || ""}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="time_work">作業内容:</label>
        <select id="time_work" name="time_work" value={data?.time_work || ""} onChange={handleChange}>
          <option value="">選択してください</option>
          <DefSelect defData={defData} />
        </select>
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
            ampm={false} // 24時間表示を有効に設定
            minutesStep={5} // 5分間隔に設定
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
            ampm={false} // 24時間表示を有効に設定
            minutesStep={5} // 5分間隔に設定
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