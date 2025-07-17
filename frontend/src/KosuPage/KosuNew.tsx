import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import Loading from "../components/Loading";
import DefSelect from "../components/DefSelect";
import styles from "../styles/KosuPage/KosuNew.module.css";
import { LocalizationProvider, TimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";

interface Kosu {
  employee_no3: number;
  work_day2: string;
  tyoku2: string;
  time_work: string;
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
  [key: string]: string | undefined;
}

const KosuNew: React.FC = () => {
  const [data, setData] = useState<Kosu | null>(null);
  const [defData, setDefData] = useState<DefData>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>("");

  const [selectedTime, setSelectedTime] = useState<Dayjs>(dayjs());
  const [showClock, setShowClock] = useState<boolean>(false);

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
        setDefData(response.data.def_data || {});
        const member_data = response.data.member_data;
        if (member_data?.name) setMemberName(member_data.name);

        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        setErrorMessage("データの取得に失敗しました。");
        setLoading(false);
      });
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (data) setData({ ...data, [name]: value });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;

    const timeString = selectedTime.format("HH:mm");

    const payload = {
      ...data,
      start_time: timeString,
    };

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, payload, { withCredentials: true })
      .then(() => alert("更新が成功しました！"))
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
        <input type="date" id="work_day2" name="work_day2" value={data?.work_day2 || ""} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="tyoku2">直:</label>
        <input type="text" id="tyoku2" name="tyoku2" value={data?.tyoku2 || ""} onChange={handleChange} />
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
        <textarea id="detail_work" name="detail_work" value={data?.detail_work || ""} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="over_time">残業時間:</label>
        <input type="number" id="over_time" name="over_time" value={data?.over_time || 0} onChange={handleChange} />
      </div>

      {/* ⏰ 開始時間（Material UI TimePicker） */}
      <div>
        <label htmlFor="start_time">開始時間:</label>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <TimePicker
            value={selectedTime}
            onChange={(newTime) => {
              if (newTime) setSelectedTime(newTime);
              setShowClock(true);
            }}
            ampm={false}
            views={["hours", "minutes"]}
            minutesStep={5}
          />
        </LocalizationProvider>
      </div>

      <button type="submit">更新</button>
    </form>
  );
};

export default KosuNew;
