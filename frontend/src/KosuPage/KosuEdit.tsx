import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import TyokuSelect from "../components/TyokuSelect";
import WorkSelect from "../components/WorkSelect";
import Loading from "../components/Loading";
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

interface KosuResponse {
  kosu_data: Kosu;
  def_data: DefData;
}

const KosuEdit: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Kosu | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const [defData, setDefData] = useState<DefData>({});
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null);
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null);
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{ time1: string; time2: string; work: string; detail: string }[]>([]);

  useEffect(() => {
    axios
      .get<KosuResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const { kosu_data } = response.data;
        setFormData(kosu_data);
        const def_data = response.data.def_data || {};
        setDefData(def_data);
        setInitialTimeWork(kosu_data.time_work);
        setInitialWorkDetail(kosu_data.detail_work);
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
    const parseTimeWorkAndDetail = () => {
      const result: { time1: string; time2: string; work: string; detail: string }[] = [];
      let currentWork = "";
      let currentDetail = "";
      let startIndex = -1;
  
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .reduce((acc, key, index) => {
          const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";
          acc[alphabet[index]] = defData[key] ?? null;
          return acc;
        }, {} as Record<string, string | null>);
  
      const splitDetails = (formData?.detail_work || "").split("$").map((detail) => detail || "");
  
      for (let i = 0; i <= (formData?.time_work || "").length; i++) {
        const charWork = formData?.time_work?.[i] ?? "";
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork];
        const charDetail = splitDetails[Math.floor(i / ((formData?.time_work || "").length / splitDetails.length))] ?? "";
  
        if (charWork === "#" || charWork === undefined) {
          if (currentWork || currentDetail) {
            const startHour = Math.floor((startIndex * 5) / 60);
            const startMinute = (startIndex * 5) % 60;
            const endHour = Math.floor((i * 5) / 60);
            const endMinute = (i * 5) % 60;

            const timeRange1 = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
            const timeRange2 = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            result.push({ time1: timeRange1, time2: timeRange2, work: currentWork, detail: currentDetail });
          }
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          if (currentWork || currentDetail) {
            const startHour = Math.floor((startIndex * 5) / 60);
            const startMinute = (startIndex * 5) % 60;
            const endHour = Math.floor((i * 5) / 60);
            const endMinute = (i * 5) % 60;
  
            const timeRange1 = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
            const timeRange2 = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            result.push({ time1: timeRange1, time2: timeRange2, work: currentWork, detail: currentDetail });
          }
          currentWork = mappedWork || charWork;
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      return result;
    };
  
    setParsedData(parseTimeWorkAndDetail());
  }, [formData?.time_work, formData?.detail_work, defData]);

  // エラー時の表示
  if (error) {
    return <div>Error: {error}</div>;
  }

  // データが存在しない場合
  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_update/${id}/`, formData, { withCredentials: true })
      .then(() => {
        alert("データが更新されました！");
        navigate("/kosu-list");
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

  console.log(parsedData)

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["kosu-edit-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数データ編集</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-list">工数履歴</Link>
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
            <input
              type="date"
              id="work_day2"
              name="work_day2"
              value={formData.work_day2}
              onChange={handleChange}
            />

            <label htmlFor="work_time">勤務・直:</label>
            <div className={styles["work-tyoku-wrapper"]}>
              <WorkSelect value={formData?.work_time || ''} onChange={handleChange} />
              <TyokuSelect value={formData?.tyoku2 || ''} onChange={handleChange} />
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
                value={formData?.over_time || 0}
                onChange={handleChange}
              />
              <button
                type="button"
                className={styles["custom-button"]}
                onClick={() => handleIncrement("over_time")}
              >
                +
              </button>
            </div>
            <button type="submit" className="light_blue_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default KosuEdit;