import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";
import axios from "axios";
import api from "../api/axios";
import Loading from "../Components/Loading";
import TyokuSelect from "../Components/TyokuSelect";
import WorkSelect from "../Components/WorkSelect";
import DefSelect from "../Components/DefSelect";
import KosuDisplay from "../Components/KosuDisplay";
import KosuBarChart from "../Components/KosuBarChart";
import DefTable from "../Components/DefTable";
import styles from "../styles/KosuPage/KosuNew.module.css";

interface Kosu {
  id: string;
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

interface DetailData {
  def_symbol: string;
  def_select: string;
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
  const navigate = useNavigate();
  const [data, setData] = useState<Kosu | null>(null); // 工数データ
  const [defData, setDefData] = useState<DefData>({}); // 工数区分定義データ
  const [detailList, setDetailList] = useState<DetailData[]>([]); // 作業詳細の選択肢リスト
  const [isDetailSelectMode, setIsDetailSelectMode] = useState<boolean>(false); // 手入力モード (false = 選択, true = 手入力)
  const [loading, setLoading] = useState(true); // ローディング状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ
  const [warningMessage, setWarningMessage] = useState<string | null>(null); // 警告メッセージ
  const [memberName, setMemberName] = useState<string>(""); // メンバー名
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null); // 初期の作業内容
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null); // 初期の作業詳細
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null); // 初期の直
  const [memberShop, setMemberShop] = useState<string>(""); // メンバーの所属部署
  const [isTomorrowChecked, setIsTomorrowChecked] = useState<boolean>(false); // 翌日チェックボックスの状態
  const [isBreakChangeChecked, setIsBreakChangeChecked] = useState<boolean>(false); // 休憩変更チェックボックスの状態
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const prevTyokuRef = useRef<string | null>(null);
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

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get("/api/kosu_new/");
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
        time_work: "",
        detail_work: "",
      });
      const def_data = response.data.def_data || {};
      setDefData(def_data);
      
      const detail_list = response.data.detail_list || [];
      setDetailList(detail_list);

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
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleChange = async (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (data) {
      let updatedData = { ...data, [name]: name === "over_time" ? parseInt(value, 10) || 0 : value };

      if (name === "time_work" && value !== "") {
        const currentDetail = detailList.find(d => d.def_select === data.detail_work);
        if (currentDetail && currentDetail.def_symbol !== value) {
          updatedData.detail_work = "";
        }
      }

      if (name === "detail_work" && !isDetailSelectMode) {
        const selectedDetail = detailList.find(d => d.def_select === value);
        if (selectedDetail) {
          updatedData.time_work = selectedDetail.def_symbol;
        }
      }

      setData(updatedData);

      if (name === "work_day2") {
        try {
          await api.post("/api/set_day/", { day: value || "" });
          fetchData();
        } catch (err) {
          if (axios.isAxiosError(err)) {
            if (err.response?.status === 401) navigate("/login");
            else setErrorMessage(err.response?.data.message);
          } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    if (!data.work_time || !data.tyoku2 || !data.time_work || !data.detail_work || !formattedTime1 || !formattedTime2) {
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
      if ((time1InMinutes < time2InMinutes && hoursDifference > 21) || (time1InMinutes > time2InMinutes && hoursDifference < 3)) {
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

    try {
      await api.post("/api/kosu_new/", updatedData);
      setSuccessMessage("更新が成功しました！");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 1000);
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
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  const handleSendOverTime = async () => {
    if (!data) return;

    const overTime = data.over_time || 0;

    if (data.work_time !== "休出" && overTime % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    if (data.work_time === "休出" && overTime % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }

    try {
      await api.post("/api/over_time/", data);
      alert("残業情報を送信しました！");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  const handleIncrement = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) + 15 });
    }
  };
  const handleIncrement2 = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) + 1 });
    }
  };
  const handleDecrement = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) - 15 });
    }
  };
  const handleDecrement2 = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) - 1 });
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (prevTyokuRef.current !== null && data?.tyoku2 && data.tyoku2 !== prevTyokuRef.current) {
      const workDay = data ? new Date(data.work_day2) : new Date();
      let newTime = new Date(workDay);

      if (data.tyoku2 === "1" || data.tyoku2 === "5") {
        newTime.setHours(6, 30, 0, 0);
      } else if (data.tyoku2 === "2" && (memberShop === "W1" || memberShop === "W2" || memberShop === "A1" || memberShop === "A2" || memberShop === "J" || memberShop === "組長以上(W,A)")) {
        newTime.setHours(11, 10, 0, 0);
      } else if (data.tyoku2 === "2") {
        newTime.setHours(13, 50, 0, 0);
      } else if (data.tyoku2 === "3" && (memberShop === "W1" || memberShop === "W2" || memberShop === "A1" || memberShop === "A2" || memberShop === "J" || memberShop === "組長以上(W,A)")) {
        newTime.setHours(19, 50, 0, 0);
      } else if (data.tyoku2 === "3") {
        newTime.setHours(22, 25, 0, 0);
      } else if (data.tyoku2 === "4") {
        newTime.setHours(8, 0, 0, 0);
      } else if (data.tyoku2 === "6") {
        newTime.setHours(17, 10, 0, 0);
      } else {
        prevTyokuRef.current = data.tyoku2;
        return;
      }

      setSelectedTimes({
        time1: newTime,
        time2: newTime,
      });
      updateCachedTimes(newTime, newTime);
    }
    if (data?.tyoku2) {
      prevTyokuRef.current = data.tyoku2;
    }
  }, [data?.tyoku2, memberShop, data?.work_day2, data]);

  const filteredDetailList = data?.time_work 
    ? detailList.filter(item => item.def_symbol === data.time_work)
    : detailList;

  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-new-wrapper"]}>
        <h1 className={styles["h1-collar"]}>{memberName}の工数入力</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
          <Link to="/">メインMENU</Link>
          {data?.id && (
            <Link to={`/kosu-update/${data.id}`}>工数編集</Link>
          )}
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
            <label htmlFor="work_day2">就業日：
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

            <label htmlFor="work_time">勤務・直：</label>
            <div className={styles["work-tyoku-wrapper"]}>
              <WorkSelect id="work_time" value={data?.work_time || ""} onChange={handleChange} mode='LIMIT' />
              <TyokuSelect id="tyoku2" value={data?.tyoku2 || ""} onChange={handleChange} />
            </div>

            <label htmlFor="time_work">
              作業内容：
              <Link to="/def-search" className={`green_button ${styles["font-min"]}`}>
                工数区分定義確認
              </Link>
            </label>
            <DefSelect id="time_work" value={data?.time_work || ""} onChange={handleChange} defData={defData} />

            <label htmlFor="detail_work">
              作業詳細：
              <span>
                手入力：
                <input 
                  type="checkbox" 
                  checked={isDetailSelectMode} 
                  onChange={(e) => setIsDetailSelectMode(e.target.checked)} 
                />
              </span>
            </label>
            
            {isDetailSelectMode ? (
              <input
                type="text"
                id="detail_work"
                name="detail_work"
                value={data?.detail_work || ""}
                onChange={handleChange}
              />
            ) : (
              <select
                id="detail_work"
                name="detail_work"
                value={data?.detail_work || ""}
                onChange={handleChange}
              >
                <option value="">-- 作業詳細を選択 --</option>
                {filteredDetailList.map((item, index) => (
                  <option key={index} value={item.def_select}>
                    {item.def_select}
                  </option>
                ))}
              </select>
            )}

            <label>
              作業時間：
              <button type="button" onClick={setTime2ToCurrentRounded} className={`light_blue_button ${styles["font-min"]}`}>
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

            <label htmlFor="over_time">
              残業時間：
              <button
                type="button"
                onClick={handleSendOverTime}
                className={`light_blue_button ${styles["font-min"]}`}
              >
                残業のみ登録
              </button>
            </label>
            <div className={styles["over-time-wrapper"]}>
              <button
                type="button"
                className={styles["custom-button2"]}
                onClick={() => handleDecrement2("over_time")}
              >
                -
              </button>
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
                className={styles["custom-button2"]}
                onClick={() => handleIncrement2("over_time")}
              >
                +
              </button>
            </div>

            <div className={styles["switch-wrapper"]}>
              <label htmlFor="break_change">休憩時間工数入力可：
                <Link to="/today-break-time" className={`light_blue_button ${styles["font-min"]}`}>
                  休憩変更登録
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
            <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""} defData={defData} tyoku={initialTyoku || ""} shop={memberShop || ""} headerColor="#0ff" />
            <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
            <DefTable defData={defData} />
          </div>
        )}
      </div>
    </>
  );
};

export default KosuNew;