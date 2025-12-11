import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading"; 
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
  judgement: boolean;
  break_change: boolean;
}

interface Member {
  employee_no: number;
  name: string;
  shop: string;
}

interface KosuResponse {
  kosu_data: Kosu;
  member_data: Member;
}

const AdministratorKosuUpdate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Kosu | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 初回マウント時に該当従業員のデータを取得
  useEffect(() => {
    axios
      .get<KosuResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_kosu_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const { kosu_data } = response.data;
        setFormData(kosu_data);
        setLoading(false);
      })
      .catch((err) => {
        // エラーステータスによって遷移やメッセージ制御
        if (err.response?.status === 401) {
          navigate("/login"); // 認証なし → ログインページへ
        } else if (err.response?.status === 403) {
          navigate("/"); // 権限なし → ホームへ
        } else {
          setError(err.message); // その他のエラーをステートに格納
        }
        setLoading(false);
      });
  }, [id, navigate]);

  // ローディング中の表示
  if (loading) {
    return <div>loading</div>;
  }

  // エラー時の表示
  if (error) {
    return <div>Error: {error}</div>;
  }

  // データが存在しない場合
  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  // フォーム送信時（PUTで更新）
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/manager_kosu_update/${id}/`, formData, { withCredentials: true })
      .then(() => {
        alert("データが更新されました！");
        navigate("/manager-kosu");
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

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-kosu-update-wrapper"]}>
        <h1 className={styles["h1-collar"]}>全工数データ編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-kosu">全工数履歴一覧</Link>
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
            <label htmlFor="employee_no">従業員番号:</label>
            <input
              type="number"
              id="employee_no"
              name="employee_no"
              value={formData.employee_no3}
            />
            <button type="submit" className="gray_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AdministratorKosuUpdate;