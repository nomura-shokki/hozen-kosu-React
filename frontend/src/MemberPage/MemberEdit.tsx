import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import ShopSelect from '../components/ShopSelect';
import { useNavigate, useParams, Link } from "react-router-dom";
import styles from "../styles/MemberPage/MemberEdit.module.css";



interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
  break_time1: string;
  break_time1_over1: string;
  break_time1_over2: string;
  break_time1_over3: string;
  break_time2: string;
  break_time2_over1: string;
  break_time2_over2: string;
  break_time2_over3: string;
  break_time3: string;
  break_time3_over1: string;
  break_time3_over2: string;
  break_time3_over3: string;
  break_time4: string;
  break_time4_over1: string;
  break_time4_over2: string;
  break_time4_over3: string;
  break_time5: string;
  break_time5_over1: string;
  break_time5_over2: string;
  break_time5_over3: string;
  break_time6: string;
  break_time6_over1: string;
  break_time6_over2: string;
  break_time6_over3: string;
  pop_up1: string;
  pop_up_id1: string;
  pop_up2: string;
  pop_up_id2: string;
  pop_up3: string;
  pop_up_id3: string;
  pop_up4: string;
  pop_up_id4: string;
  pop_up5: string;
  pop_up_id5: string;
  break_check: boolean;
  def_prediction: boolean;
}

const MemberEdit: React.FC = () => {
  const { employee_no } = useParams<{ employee_no: string }>();
  const employeeNo = Number(employee_no);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<Member | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/member_update/${employeeNo}/`, { withCredentials: true })
      .then((response) => {
        setFormData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate('/');
        } else {
          setError(err.message);
        }
        setLoading(false); // ロード状態は解除
      });
  }, [employeeNo, navigate]); // `navigate`を依存配列に追加

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;

    if (type === 'checkbox') {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [name]: checked,
        };
      });
    } else {
      setFormData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [name]: value,
        };
      });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/member_update/${employeeNo}/`, formData, { withCredentials: true })
      .then(() => {
        alert("データが更新されました！");
        navigate("/member-list");
      })
      .catch((error) => {
        console.error(error);
        // サーバーからのエラーメッセージを取得
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage('不明なエラーが発生しました。IT担当者に連絡してください。');
        }
      });
  };

  return (
    <div className={styles["member-edit-wrapper"]}>
      <h1 className={styles["h1-collar"]}>人員データ編集</h1>
      <nav className={styles["member-nav"]}>
        <Link to="/member-list">人員一覧</Link>
      </nav>

      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles["search-bar"]}>
          <div className={styles["search-bar-row"]}>
          <label htmlFor="employee_no">従業員番号:</label>
            <input
              type="number"
              id="employee_no"
              name="employee_no"
              value={formData.employee_no}
              onChange={handleChange}
            />

            <label htmlFor="name">氏名:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />

            <label htmlFor="shop">ショップ:</label>
            <ShopSelect
              name="shop"
              value={formData.shop}
              onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
            />

            <div className={styles["switch-wrapper"]}>
              <label htmlFor="authority">権限:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="authority"
                  name="authority"
                  checked={formData.authority}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            <div className={styles["switch-wrapper"]}>
              <label htmlFor="administrator">管理者権限:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="administrator"
                  name="administrator"
                  checked={formData.administrator}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
          </div>
          <button type="submit" className="yellow_button">更新</button>
        </div>
      </form>
    </div>
  );
};

export default MemberEdit;