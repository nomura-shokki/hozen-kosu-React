import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorUpdate.module.css";

// 型定義
interface Admin {
  menu_row: number;
  administrator_employee_no1: number;
  administrator_employee_no2: number;
  administrator_employee_no3: number;
  answer: string;
}

// メンバー情報の型定義
interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

// APIからのレスポンスデータの型定義を更新
interface Response {
  admin_data: Admin; // 問い合わせデータ本体
  login_data: Member; // ログインユーザーのメンバー情報
}

// KosuEditコンポーネントの定義
const AdminUpdate: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Admin | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_update/`, { withCredentials: true })
      .then((response) => {
        const { admin_data } = response.data;
        setFormData(admin_data); // フォームデータをセット（変換後の名前付き）
        setLoading(false); // ローディング終了
      })
      .catch((err) => {
        console.error("APIエラー:", err);
        // 認証エラー (401) の場合はログイン画面へ遷移
        if (err.response?.status === 401) {
          navigate("/login");
        } else {
          setError(err.message); // その他のエラーをセット
        }
        setLoading(false); // ローディング終了
      });
  }, [id, navigate]); // 依存配列: idとnavigateが変更されたときのみ実行

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    // name属性に基づいてformDataを更新
    setFormData((prevData) => {
      // prevDataがnullの場合は更新をスキップまたは初期値で返す
      if (!prevData) return null;
      return {
        ...prevData,
        [name]: value,
      } as Admin;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // formDataがnullでないことを確認
    if (!formData) {
      setError("フォームデータがありません。");
      return;
    }

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/manager_update/`, formData, { withCredentials: true })
      .then(() => {
        alert("登録完了！");
        navigate("/"); 
      })
      .catch((error) => {
        console.error(error);
        if (error.response && error.response.data && typeof error.response.data === 'string') {
          // 500エラーでHTMLが返された場合など
          alert("編集時に不明なサーバーエラーが発生しました。IT担当者に連絡してください。");
        } else if (error.response && error.response.data) {
          const errorMessage = error.response.data.detail || error.response.data.error || "削除時にエラーが発生しました。";
          alert(errorMessage);
        } else {
          alert("ネットワークエラーまたは不明なエラーが発生しました。");
        }
      });
  };

  // ローディング中またはエラー、データがない場合の表示
  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!formData) {
    // データの取得が完了したが、なぜかformDataがnullの場合
    return <div>データが見つかりません</div>;
  }

  // レンダリング
  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-update-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

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
            <label htmlFor="inquiry">問い合わせ：</label>
            <input
              id="menu_row"
              name="menu_row"
              value={formData.menu_row}
              onChange={handleChange}
            />
            <div className={styles["pagination-buttons"]}>
              <button type="submit" className="pink_button">編集</button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default AdminUpdate;