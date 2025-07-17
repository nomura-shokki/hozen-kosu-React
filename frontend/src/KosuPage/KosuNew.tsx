import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/KosuNew.module.css";

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

const KosuNew: React.FC = () => {
  const [data, setData] = useState<Kosu | null>(null); // 工数データ
  const [defData, setDefData] = useState<DefData>({}); // 工数区分データ
  const [loading, setLoading] = useState(true); // ローディング状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ
  const [memberName, setMemberName] = useState<string>(""); // Djangoから取得した従業員名

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_new/`, { withCredentials: true })
      .then((response) => {
        // kosu_data のセット
        const kosu_data = response.data.kosu_data || {
          employee_no3: 0,
          work_day2: "",
          tyoku2: "",
          time_work: "", // 初期値は空文字列
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

        // def_data のセット
        const def_data = response.data.def_data || {};
        setDefData(def_data);

        // member_name のセット
        const member_data = response.data.member_data; // APIのレスポンスから member_data を取得
        if (member_data?.name) {
          setMemberName(member_data.name); // 名前を状態にセット
        }

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
    if (data) {
      setData({ ...data, [name]: value });
    }
  };

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

  if (loading) return <Loading isLoading={loading} />;
  if (errorMessage) return <div>{errorMessage}</div>;

  const renderOptions = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"; // アルファベット順
    const defDataEntries = Object.keys(defData) // defDataのキーを取得
      .filter((key) => key.startsWith("kosu_title_")) // kosu_title_で始まるキーのみ抽出
      .map((key, index) => ({
        label: defData[key], // 画面に表示するラベル（kosu_title_* の値）
        value: alphabet[index], // フォームに送信する値（アルファベット）
      }))
      .filter(({ label }) => label); // labelが空でないもののみ選択肢に追加

    // 選択肢を JSX に変換
    const options = defDataEntries.map(({ label, value }) => (
      <option key={value} value={value}>
        {label}
      </option>
    ));

    // 最後に「休憩」を追加
    options.push(
      <option key="#" value="#">
        休憩
      </option>
    );

    return options;
  };

  return (
    <form onSubmit={handleSubmit} className={styles["kosu-form"]}>
      {/* Djangoから取得した従業員名をタイトルとして表示 */}
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
        <select
          id="time_work"
          name="time_work"
          value={data?.time_work || ""}
          onChange={handleChange}
        >
          <option value="">選択してください</option>
          {renderOptions()}
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
      <button type="submit">更新</button>
    </form>
  );
};

export default KosuNew;