import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import DefVersionSelect from "../components/DefVersionSelect";
import WorkSelect from "../components/WorkSelect";
import TyokuSelect from "../components/TyokuSelect";
import styles from "../styles/AdministratorPage/AdministratorKosuUpdate.module.css";

// サーバーから取得・送信される人員データの型定義
interface Kosu {
  employee_no3: number;
  work_day2: string;
  tyoku2: string;
  time_work: string;
  detail_work: string;
  over_time: number;
  work_time: string;
  def_ver2: string;
  breaktime: string;
  breaktime_over1: string;
  breaktime_over2: string;
  breaktime_over3: string;
  judgement: boolean;
  break_change: boolean;
}

interface Member {
  employee_no: number;
  name: string;
  shop: string;
}

interface DefData {
  id: number;
  kosu_name: string;
}

interface KosuResponse {
  kosu_data: Kosu;
  member_data: Member;
  choices: DefData[];
  current_version: string;
}

const splitTimeWork = (timeWork: string): string[] => {
  const segments: string[] = [];
  for (let i = 0; i < 24; i++) {
    segments.push(timeWork.slice(i * 12, (i + 1) * 12) || "");
  }
  return segments;
};

const joinTimeWorkSegments = (segments: string[]): string => {
  return segments.map(segment => {
    return segment.padEnd(12, ' ');
  }).join('');
};

const splitDetailWork = (detailWork: string): string[] => {
  const elements = detailWork.split('$').slice(0, 288);
  while (elements.length < 288) {
    elements.push('');
  }
  
  const segments: string[] = [];
  for (let i = 0; i < 24; i++) {
    const segmentElements = elements.slice(i * 12, (i + 1) * 12);
    segments.push(segmentElements.join('$'));
  }
  return segments;
};

const joinDetailWorkSegments = (segments: string[]): string => {
  const allElements = segments.flatMap(segment => segment.split('$'));
  return allElements.slice(0, 288).join('$');
};

const isValidTimeFormat = (timeStr: string): boolean => {
  if (!/^\d{4}$/.test(timeStr)) return false;
  
  const hour = parseInt(timeStr.substring(0, 2), 10);
  const minute = parseInt(timeStr.substring(2, 4), 10);

  // 時のチェック (00〜23)
  if (hour < 0 || hour > 23) return false;
  
  // 分のチェック (00〜59、かつ5分刻み)
  if (minute < 0 || minute > 59 || minute % 5 !== 0) return false;

  return true;
};

const validateBreakTime = (breakTimeValue: string, fieldName: string): string | null => {
  if (breakTimeValue === "") {
    // 空欄は許可すると仮定します。もし必須であればこのチェックを変更してください。
    return null; 
  }

  // フォーマットチェック: # + 8桁の数字
  const regex = /^#(\d{8})$/;
  const match = breakTimeValue.match(regex);
  
  if (!match) {
    return `${fieldName} のフォーマットが正しくありません。#と8桁の数字（例: #12001300）で入力してください。`;
  }

  const timeNumbers = match[1];
  const startTimeStr = timeNumbers.substring(0, 4);
  const endTimeStr = timeNumbers.substring(4, 8);

  // 時刻の妥当性チェック
  if (!isValidTimeFormat(startTimeStr)) {
    return `${fieldName} の開始時刻 ${startTimeStr} が無効な時刻（00:00〜23:55、5分刻み）です。`;
  }
  if (!isValidTimeFormat(endTimeStr)) {
    return `${fieldName} の終了時刻 ${endTimeStr} が無効な時刻（00:00〜23:55、5分刻み）です。`;
  }
  return null;
};


const AdministratorKosuUpdate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Kosu | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [choices, setChoices] = useState<DefData[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeWorkSegments, setTimeWorkSegments] = useState<string[]>(Array(24).fill(""));
  const [detailWorkSegments, setDetailWorkSegments] = useState<string[]>(Array(24).fill(""));

  useEffect(() => {
    axios
      .get<KosuResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_kosu_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const { kosu_data, choices } = response.data;
        setFormData(kosu_data);
        setTimeWorkSegments(splitTimeWork(kosu_data.time_work));
        setDetailWorkSegments(splitDetailWork(kosu_data.detail_work));
        setLoading(false);
        setChoices(choices);
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setErrorMessage(err.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
          setLoading(false);
      });
  }, [id, navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (formData) {
      const { name, value, type, checked } = e.target;
      
      let updatedValue: string | number | boolean;
      
      if (type === 'checkbox') {
        updatedValue = checked;
      } else if (name === 'employee_no3' && type === 'number') {
        updatedValue = Number(value);
      } else if (name === 'over_time' && type === 'number') {
        updatedValue = Number(value); 
      } else {
        updatedValue = value;
      }

      setFormData({
        ...formData,
        [name]: updatedValue,
      });
    }
  };

  const handleSegmentChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, 12);
    setTimeWorkSegments(prevSegments => {
      const newSegments = [...prevSegments];
      newSegments[index] = newValue;
      return newSegments;
    });
  };

  const handleDetailSegmentChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    setDetailWorkSegments(prevSegments => {
      const newSegments = [...prevSegments];
      newSegments[index] = newValue;
      return newSegments;
    });
  };


  const handleSelectChange = (key: keyof Kosu) => (e: ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;

    if (formData) {
      setFormData({
        ...formData,
        [key]: newValue,
      });
    }
  };

  const handleIncrement = (field: keyof Kosu) => {
    if (formData) {
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) + 15 });
    }
  };
  const handleIncrement2 = (field: keyof Kosu) => {
    if (formData) {
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) + 1 });
    }
  };
  const handleDecrement = (field: keyof Kosu) => {
    if (formData) {
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) - 15 });
    }
  };
  const handleDecrement2 = (field: keyof Kosu) => {
    if (formData) {
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) - 1 });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData) return;

    setErrorMessage(null);

    if (!formData.employee_no3 || formData.employee_no3 === 0) {
        setErrorMessage("従業員番号は必須です。空欄や0は許可されません。");
        return;
    }

    if (!formData.work_day2) {
        setErrorMessage("就業日は必須です。空欄は許可されません。");
        return;
    }

    for (let i = 0; i < detailWorkSegments.length; i++) {
      const segment = detailWorkSegments[i];
      const dollarCount = (segment.match(/\$/g) || []).length;

      if (dollarCount !== 11) {
        setErrorMessage(`${i + 1}時台作業詳細のフォームは12要素にしてください（$が11個必要です）。`);
        return;
      }
    }

    const breakTimeFields: Array<[keyof Kosu, string]> = [
      ["breaktime", "昼休憩時間"],
      ["breaktime_over1", "残業休憩時間1"],
      ["breaktime_over2", "残業休憩時間2"],
      ["breaktime_over3", "残業休憩時間3"],
    ];

    for (const [fieldKey, fieldName] of breakTimeFields) {
      const value = formData[fieldKey] as string;
      const error = validateBreakTime(value, fieldName);
      if (error) {
        setErrorMessage(error);
        return;
      }
    }

    const updatedTimeWork = joinTimeWorkSegments(timeWorkSegments);
    const updatedDetailWork = joinDetailWorkSegments(detailWorkSegments);
    const dataToSubmit = { 
      ...formData, 
      time_work: updatedTimeWork,
      detail_work: updatedDetailWork,
    };

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/manager_kosu_update/${id}/`, dataToSubmit, { withCredentials: true })
      .then(() => {
        alert("データが更新されました！");
        navigate("/manager-kosu");
      })
      .catch((err) => {
        console.error(err);
        if (err.response && err.response.data) {
          setErrorMessage(err.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  const handleDelete = () => {
    if (!id) return;

    if (!window.confirm("このデータを完全に削除してもよろしいですか？この操作は元に戻せません。")) {
      return;
    }

    setErrorMessage(null);

    axios
      .delete(`${process.env.REACT_APP_API_BASE_URL}/api/manager_kosu_update/${id}/`, { withCredentials: true })
      .then(() => {
        alert("データが削除されました！");
        navigate("/manager-kosu");
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else  setErrorMessage(err.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        setLoading(false);
      });
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-kosu-update-wrapper"]}>
        <h1 className={styles["h1-collar"]}>全工数データ編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-kosu">全工数履歴一覧</Link>
        </nav>

        {errorMessage && (
          <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}>{errorMessage}</div>
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
            <label htmlFor="employee_no3">従業員番号:</label>
            <input
              type="number"
              name="employee_no3"
              id="employee_no3"
              value={formData.employee_no3}
              onChange={handleChange}
            />
            <label htmlFor="def_ver2">工数区分定義:</label>
            <DefVersionSelect
              id="def_ver2"
              choices={choices}
              selectedVersion={formData.def_ver2}
              onChange={handleSelectChange("def_ver2")}
            />
            <label htmlFor="work_day2">就業日:</label>
            <input
              type="date"
              id="work_day2"
              name="work_day2"
              value={formData.work_day2}
              onChange={handleChange}
            />
            <label htmlFor="work_time">勤務形態:</label>
            <WorkSelect
              id="work_time"
              value={formData?.work_time || ""}
              onChange={handleSelectChange("work_time")}
              mode='ALL'
            />
            <label htmlFor="tyoku2">直:</label>
            <TyokuSelect
              id="tyoku2"
              value={formData?.tyoku2 || ""}
              onChange={handleSelectChange("tyoku2")}
            />
            {timeWorkSegments.map((segment, index) => (
              <div key={`time_work_${index}`} className={styles["work-log-form-container"]}>
                <label htmlFor={`time_work_segment_${index}`}>{index + 1}時台作業内容:</label>
                <input
                  type="text"
                  id={`time_work_segment_${index}`}
                  value={segment}
                  onChange={handleSegmentChange(index)}
                  maxLength={12}
                  minLength={12}
                />
              </div>
            ))}
            {detailWorkSegments.map((segment, index) => (
              <div key={`detail_work_${index}`} className={styles["work-log-form-container"]}>
                <label htmlFor={`detail_work_segment_${index}`}>{index + 1}時台作業詳細:</label>
                <input
                  type="text"
                  id={`detail_work_segment_${index}`}
                  value={segment}
                  onChange={handleDetailSegmentChange(index)}
                />
              </div>
            ))}
            <label htmlFor="over_time">残業:</label>
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
                name="over_time"
                id="over_time"
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
              <button
                type="button"
                className={styles["custom-button2"]}
                onClick={() => handleIncrement2("over_time")}
              >
                +
              </button>
            </div>
            <label htmlFor="breaktime">昼休憩時間:</label>
            <input
              type="text"
              name="breaktime"
              id="breaktime"
              value={formData?.breaktime || ""}
              onChange={handleChange}
            />
            <label htmlFor="breaktime_over1">残業休憩時間1:</label>
            <input
              type="text"
              name="breaktime_over1"
              id="breaktime_over1"
              value={formData?.breaktime_over1 || ""}
              onChange={handleChange}
            />
            <label htmlFor="breaktime_over2">残業休憩時間2:</label>
            <input
              type="text"
              name="breaktime_over2"
              id="breaktime_over2"
              value={formData?.breaktime_over2 || ""}
              onChange={handleChange}
            />
            <label htmlFor="breaktime_over3">残業休憩時間3:</label>
            <input
              type="text"
              name="breaktime_over3"
              id="breaktime_over3"
              value={formData?.breaktime_over3 || ""}
              onChange={handleChange}
            />
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="judgement">整合性:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="judgement"
                  name="judgement"
                  checked={formData?.judgement || false}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="break_change">休憩変更チェック:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="break_change"
                  name="break_change"
                  checked={formData?.break_change || false}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            {errorMessage && (
              <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}>{errorMessage}</div>
            )}

            <button type="submit" className="gray_button" style={{ marginTop: '20px' }}>更新</button>
            <button 
              type="button"
              className="gray_button" 
              style={{ marginTop: '20px', backgroundColor: '#dc3545', color: 'white' }}
              onClick={handleDelete}
            >
              削除
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AdministratorKosuUpdate;