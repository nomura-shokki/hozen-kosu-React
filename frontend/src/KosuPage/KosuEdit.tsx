import React, { useState, useEffect, FormEvent, ChangeEvent, useCallback } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import TyokuSelect from "../components/TyokuSelect";
import WorkSelect from "../components/WorkSelect";
import DefSelect from "../components/DefSelect";
import KosuBarChart from "../components/KosuBarChart"; 
import DefTable from "../components/DefTable";
import Loading from "../components/Loading";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";
import styles from "../styles/KosuPage/KosuEdit.module.css";

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

interface Member {
  employee_no: number;
  name: string;
  shop: string;
}

interface KosuResponse {
  kosu_data: Kosu;
  def_data: DefData;
  member_data: Member;
}

const KosuEdit: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Kosu | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const [defData, setDefData] = useState<DefData>({});
  const [memberShop, setMemberShop] = useState<string>("");
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null);
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null);
  const [timeData, setTimeData] = useState<{
    time1: Date | null;
    time2: Date | null;
    work: string;
    detail: string;
  }[]>([]);
  const [isDisabled, setIsDisabled] = useState<boolean[]>([]);
  const [isWorkTyokuDisabled, setIsWorkTyokuDisabled] = useState<boolean>(true);

  const handleError = useCallback((error: any, defaultMessage: string) => {
    if (error.response && error.response.data && error.response.data.error) {
      setErrorMessage(error.response.data.error);
    } else {
      setErrorMessage(defaultMessage);
    }
  }, []);

  useEffect(() => {
    axios
      .get<KosuResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const { kosu_data } = response.data;
        setFormData(kosu_data);
        const def_data = response.data.def_data || {};
        setDefData(def_data);
        const member_data = response.data.member_data;
        if (member_data?.shop) {
          setMemberShop(member_data.shop);
        }
        setInitialTimeWork(kosu_data.time_work);
        setInitialTyoku(kosu_data.tyoku2);
        setLoading(false);
      })
      .catch((err) => {
        console.error("APIエラー:", err);
        if (err.response?.status === 401) {
          navigate("/login");
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [id, navigate]);

  useEffect(() => {
    if (!formData) {
      return;
    }

    const { time_work, detail_work, tyoku2 } = formData;
    const timeWork = time_work;
    const workDetail = detail_work;
    const tyoku = tyoku2;

    const parseTimeWorkAndDetail = () => {
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .reduce((acc, key, index) => {
          acc["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"[index]] = defData[key] ?? null;
          return acc;
        }, {} as Record<string, string | null>);

      const adjustRange = (start: number, end: number) => ({
        adjustedTimeWork: timeWork.repeat(2).slice(start, timeWork.length * 2 - end),
        splitDetails: workDetail.split("$").concat(workDetail.split("$")).slice(start, workDetail.split("$").length * 2 - end)
      });

      const ranges: Record<string, { start: number; end: number }> = {
        "1": { start: 54, end: 234 },
        "2W_A": { start: 106, end: 182 },
        "2": { start: 140, end: 148 },
        "3W_A": { start: 214, end: 74 },
        "3": { start: 242, end: 46 },
        "4": { start: 72, end: 216 },
        "6": { start: 182, end: 106 },
      };
      const rangeKey = tyoku + ((tyoku === "2" || tyoku === "3") && (["W1", "W2", "A1", "A2", "J", "組長以上(W,A)"].includes(memberShop)) ? "W_A" : "");

      const { adjustedTimeWork, splitDetails } = ranges[rangeKey]
        ? adjustRange(ranges[rangeKey].start, ranges[rangeKey].end)
        : { adjustedTimeWork: timeWork, splitDetails: workDetail.split("$") };

      const result: { time1: string; time2: string; work: string; detail: string }[] = [];
      let currentWork = "", currentDetail = "", startIndex = -1;

      const pushResult = (i: number, offset: number) => {
        if (currentWork || currentDetail) {
          const startHour = Math.floor((startIndex + offset) / 12) % 24;
          const startMinute = ((startIndex + offset) % 12) * 5;
          const endHour = Math.floor((i + offset) / 12) % 24;
          const endMinute = ((i + offset) % 12) * 5;
          const timeRange1 = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
          const timeRange2 = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
          result.push({ time1: timeRange1, time2: timeRange2, work: currentWork, detail: currentDetail });
        }
      };

      for (let i = 0; i <= adjustedTimeWork.length; i++) {
        const charWork = adjustedTimeWork[i];
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork];
        const charDetail = splitDetails[Math.floor(i / (adjustedTimeWork.length / splitDetails.length))] ?? "";

        if (charWork === "#" || charWork === undefined) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = mappedWork || charWork;
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      return result;
    };

    const parsedResults = parseTimeWorkAndDetail();

    const newTimeData = parsedResults.map((item) => {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";
      const defOptions = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .map((key, index) => ({
          value: alphabet[index],
          label: defData[key] || "",
        }))
        .filter(({ label }) => label !== "");
      defOptions.push({ value: "$", label: "休憩" });
      const matchedOption = defOptions.find((option) => option.label === item.work);
      const workValue = matchedOption ? matchedOption.value : "";

      const baseDate = new Date();
      const [startHour, startMinute] = item.time1.split(":").map(Number);
      const [endHour, endMinute] = item.time2.split(":").map(Number);
      
      const time1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMinute);
      const time2 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute);

      return {
        time1: time1,
        time2: time2,
        work: workValue,
        detail: item.detail,
      };
    });

    if (timeData.length === 0) {
      setTimeData(newTimeData);
      // 初期状態は非アクティブなので、すべてtrueで初期化
      setIsDisabled(newTimeData.map(() => true));
    }
  }, [formData, defData]);

  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    index?: number, 
    field?: string 
  ) => {
    const { name, value } = event.target;

    if (!formData) return;

    if (index !== undefined && field) {
      setTimeData((prevTimeData) => {
        const updatedTimeData = [...prevTimeData];
        updatedTimeData[index] = {
          ...updatedTimeData[index],
          [field]: value,
        };
        return updatedTimeData;
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleTimeChange = (
    field: "time1" | "time2",
    newTime: Date | null,
    index: number
  ) => {
    if (!timeData[index]) {
      console.error(`Index ${index} is out of bounds or undefined in timeData.`);
      return;
    }
  
    const updatedTimeData = [...timeData];
    updatedTimeData[index][field] = newTime;
    setTimeData(updatedTimeData);
  };

  const handleCheckboxChange = (index: number) => {
    setIsDisabled((prevIsDisabled) => {
        const updatedDisabled = [...prevIsDisabled];
        updatedDisabled[index] = !updatedDisabled[index];
        return updatedDisabled;
    });
  };

  const handleWorkTyokuCheckboxChange = () => {
    setIsWorkTyokuDisabled((prev) => !prev);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const submittedData = timeData.reduce((acc, item, index) => {
      acc[`time1_${index + 1}`] = item.time1?.toISOString() || "";
      acc[`time2_${index + 1}`] = item.time2?.toISOString() || "";
      acc[`timeData_work_${index + 1}`] = item.work;
      acc[`timeData_detail_${index + 1}`] = item.detail || "";
      return acc;
    }, {} as Record<string, string>);

    if (!formData) return;

    const updatedFormData = {
      ...formData,
      ...submittedData,
    };
    if (!formData.work_time || !formData.tyoku2) {
      setErrorMessage("入力必要項目が入力されていません。");
      return;
    }
    if (
      Object.keys(formData).some(
        (key) =>
          (key.startsWith("time1_") || key.startsWith("time2_")) &&
          !(formData as any)[key]
      )
    ) {
      setErrorMessage("すべての作業時間を入力してください。");
      return;
    }
    if (formData.work_time !== "休出" && formData.over_time % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    if (formData.work_time === "休出" && formData.over_time % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }
    if (Object.keys(formData).some(key => key.startsWith("detail_work_") && (formData as any)[key]?.length > 100)) {
      setErrorMessage("作業詳細は100文字以内にしてください。");
      return;
    }
    if (Object.keys(formData).some(key => key.startsWith("detail_work_") && (formData as any)[key]?.includes("$"))) {
      setErrorMessage("作業詳細に『$』は使用できません。");
      return;
    }

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_update/${id}/`, updatedFormData, { withCredentials: true })
      .then(() => {
        alert("データが更新されました！");
        navigate("/kosu-list");
      })
      .catch((error) => {
        console.error("工数データ編集エラー:", error);
        handleError(error, "工数データ編集で想定外のエラーが発生しました。");
      });
  };

  const handleIncrement = (field: keyof Kosu) => {
    if (formData) {
      const currentValue = Number(formData[field]) || 0;
      setFormData({
        ...formData,
        [field]: currentValue + 15,
      });
    }
  };

  const handleDecrement = (field: keyof Kosu) => {
    if (formData) {
      const currentValue = Number(formData[field]) || 0;
      setFormData({
        ...formData,
        [field]: currentValue - 15,
      });
    }
  };

  const handleDeleteItem = (index: number) => {
    const itemToDelete = timeData[index];
  
    if (!itemToDelete) {
      console.error(`Index ${index} is out of bounds for deletion.`);
      return;
    }

    const requestData = {
      index,
      ...itemToDelete
    };
  
    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/item_delete/`, requestData, { withCredentials: true })
      .then(() => {
        alert(`行 ${index + 1} が削除されました！`);
        setTimeData((prevTimeData) =>
          prevTimeData.filter((_, i) => i !== index)
        );
      })
      .catch((error) => {
        console.error("削除中にエラーが発生しました:", error);
        setErrorMessage("削除リクエストでエラーが発生しました。");
      });
  };

  const handleSendDayUpdate = () => {
    if (!formData) return;

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/day_update/`, formData, { withCredentials: true })
      .then(() => {
        alert("日付編集を送信しました！");
      })
      .catch((error) => {
        console.error("日付変更エラー:", error);
        handleError(error, "日付変更で想定外のエラーが発生しました。");
      });
  };

  const addEmptyForm = () => {
    const baseDate = new Date()
    const time1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0);
    const time2 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0);
  
    setTimeData((prevTimeData) => [
      ...prevTimeData,
      {
        time1: time1,
        time2: time2,
        work: '',
        detail: '',
      }
    ]);
    // 新しい行が追加されたら、その行は非アクティブに設定
    setIsDisabled((prevIsDisabled) => [...prevIsDisabled, true]);
  };

  const removeLastForm = () => {
    if (timeData.length > 0) {
      setTimeData((prevTimeData) => {
        const updatedTimeData = [...prevTimeData];
        updatedTimeData.pop();
        return updatedTimeData;
      });
      // 最後の行が削除されたら、isDisabledからも対応する要素を削除
      setIsDisabled((prevIsDisabled) => prevIsDisabled.slice(0, -1));
    }
  };

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-edit-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数データ編集</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-list">工数履歴</Link>
          <Link to="/kosu-new">工数入力</Link>
        </nav>

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
              <span style={{ color: formData?.judgement ? "blue" : "red", marginLeft: "8px" }}>
                {formData?.judgement ? "OK" : "NG"}
              </span>
            </label>
            <div className={styles["day-wrapper"]}>
              <input
                type="date"
                id="work_day2"
                name="work_day2"
                value={formData.work_day2}
                className={styles["form-width"]}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={handleSendDayUpdate}
                className="light_blue_button"
              >
                就業日更新
              </button>
            </div>

            <label htmlFor="tyoku2">勤務・直・残業時間:</label>
            <div className={styles["work-tyoku-wrapper"]}>
              <label className={styles["toggle-switch"]}>
                <input 
                  type="checkbox"
                  checked={!isWorkTyokuDisabled}
                  onChange={handleWorkTyokuCheckboxChange} 
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
              <WorkSelect value={formData?.work_time || ''} onChange={handleChange} disabled={isWorkTyokuDisabled} />
              <TyokuSelect value={formData?.tyoku2 || ''} onChange={handleChange} disabled={isWorkTyokuDisabled} />
              <div className={styles["over-time-wrapper"]}>
                <button
                  type="button"
                  className={styles["custom-button"]}
                  onClick={() => handleDecrement("over_time")}
                  disabled={isWorkTyokuDisabled}
                >
                  -
                </button>
                <input
                  type="number"
                  id="over_time"
                  name="over_time"
                  value={formData?.over_time || 0}
                  className={styles["form-width2"]}
                  onChange={handleChange}
                  disabled={isWorkTyokuDisabled}
                />
                <button
                  type="button"
                  className={styles["custom-button"]}
                  onClick={() => handleIncrement("over_time")}
                  disabled={isWorkTyokuDisabled}
                >
                  +
                </button>
              </div>
            </div>

            <div className={styles["lavel-wrapper"]}>
              <label>
                作業時間・作業内容・作業詳細:
              </label>
              <button 
                type="button" 
                className="light_blue_button" 
                onClick={addEmptyForm}
              >
                行追加
              </button>
              <button 
                type="button" 
                className="light_blue_button" 
                onClick={removeLastForm}
              >
                行削除
              </button>
            </div>
            {timeData.map((item, index) => (
              <div key={`time-picker-row-${index}`} className={styles["time-picker-wrapper"]}>
                <label className={styles["toggle-switch"]}>
                  <input 
                    type="checkbox"
                    checked={!isDisabled[index]}
                    onChange={() => handleCheckboxChange(index)} 
                  />
                  <span className={styles["toggle-slider"]}></span>
                </label>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <MobileTimePicker
                    key={`time-picker-start-${index}`}
                    className={styles["time-picker"]}
                    value={item.time1}
                    onChange={(newTime) => handleTimeChange("time1", newTime, index)}
                    ampm={false}
                    minutesStep={5}
                    onAccept={() => {
                      const rootElement = document.getElementById("root");
                      if (rootElement) rootElement.removeAttribute("aria-hidden");
                    }}
                    disabled={isDisabled[index]}
                  />
                </LocalizationProvider>
                <span>〜</span>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <MobileTimePicker
                    key={`time-picker-end-${index}`} 
                    className={styles["time-picker"]}
                    value={item.time2}
                    onChange={(newTime) => handleTimeChange("time2", newTime, index)}
                    ampm={false}
                    minutesStep={5}
                    onAccept={() => {
                      const rootElement = document.getElementById("root");
                      if (rootElement) rootElement.removeAttribute("aria-hidden");
                    }}
                    disabled={isDisabled[index]}
                  />
                </LocalizationProvider>
                <DefSelect 
                  name={`timeData_work_${index}`}
                  value={item?.work || ""} 
                  className={styles["form-width"]}
                  onChange={(e) => handleChange(e, index, "work")}
                  defData={defData} 
                  disabled={isDisabled[index]}
                />
                <input
                  type="text"
                  id={`detail_work_${index}`}
                  name={`detail_work_${index}`}
                  value={item?.detail || ""}
                  className={styles["form-width"]}
                  onChange={(e) => handleChange(e, index, "detail")}
                  disabled={isDisabled[index]}
                />
                <button
                  type="button"
                  className="blue_button"
                  onClick={() => handleDeleteItem(index)}
                  disabled={isDisabled[index]}
                >
                  削除
                </button>
              </div>
            ))}
            <button type="submit" className="light_blue_button">更新</button>
          </div>
        </form>
        {initialTimeWork && (
          <div className={styles["centeredContainer"]}>
            <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
            <DefTable defData={defData} />
          </div>
        )}
      </div>
    </>
  );
};

export default KosuEdit;