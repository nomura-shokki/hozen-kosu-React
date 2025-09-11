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
  id: string
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

const KosuTotal: React.FC = () => {
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
      const updatedValue = name === "over_time" ? parseInt(value, 10) || 0 : value;

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
            fetchData();
          })
          .catch((error) => {
            console.error("エラーが発生しました:", error);
            handleError(error, "日付切り替えで想定外のエラーが発生しました");
          });
      }
    }
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
          {data && (
            <Link to={`/kosu-update/${data.id}`}>工数編集</Link>
          )}
        </nav>

        {warningMessage && (
          <div role="alert">{warningMessage}</div>
        )}

        {errorMessage && (
          <div role="alert">{errorMessage}</div>
        )}

        <form>
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
              <WorkSelect id="work_time" value={data?.work_time || ""} onChange={handleChange} mode='LIMIT' />
              <TyokuSelect id="tyoku2" value={data?.tyoku2 || ""} onChange={handleChange} />
            </div>

            <label htmlFor="time_work">
              作業内容：
              <Link to="/def-search" className="green_button">
                工数区分定義確認
              </Link>
            </label>
            <DefSelect id="time_work" value={data?.time_work || ""} onChange={handleChange} defData={defData} />

            <label htmlFor="detail_work">作業詳細:</label>
            <input
              type="text"
              id="detail_work"
              name="detail_work"
              value={data?.detail_work || ""}
              onChange={handleChange}
            />

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
            <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""} defData={defData} tyoku={initialTyoku || ""} shop={memberShop || ""} />
            <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
            <DefTable defData={defData} />
          </div>
        )}
      </div>
    </>
  );
};

export default KosuTotal;