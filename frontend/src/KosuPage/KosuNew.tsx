import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import ShopSelect from '../components/ShopSelect'; 
import styles from "../styles/KosuPage/KosuNew.module.css"; 



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

const KosuNew: React.FC = () => {
  const [data, setData] = useState<Kosu | null>(null); // 工数データ
  const [loading, setLoading] = useState(true); // ローディング状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ

  // 初回データ取得
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, { withCredentials: true })
      .then((response) => {
        // kosu_dataが存在しない場合は空データをセット
        if (!response.data.kosu_data) {
          setData({
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
          });
        } else {
          setData(response.data.kosu_data);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        setErrorMessage("データの取得に失敗しました。");
        setLoading(false);
      });
  }, []);

  // フォームの値変更ハンドラー
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (data) {
      setData({ ...data, [name]: value });
    }
  };

  // フォーム送信（更新処理）
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, data, { withCredentials: true })
      .then(() => {
        alert("更新が成功しました！");
      })
      .catch((error) => {
        console.error("更新エラー:", error);
        setErrorMessage("更新に失敗しました。再試行してください。");
      });
  };

  // ローディング中の表示
  if (loading) return <Loading isLoading={loading} />;
  if (errorMessage) return <div>{errorMessage}</div>;

  // フォーム表示
  return (
    <form onSubmit={handleSubmit} className={styles["kosu-form"]}>
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
        <textarea
          id="time_work"
          name="time_work"
          value={data?.time_work || ""}
          onChange={handleChange}
        />
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
      <button type="submit">更新</button>
    </form>
  );
};

export default KosuNew;
