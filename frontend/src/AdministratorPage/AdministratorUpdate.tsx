import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorUpdate.module.css";

// 型定義
interface Admin {
  menu_row: number;
  administrator_employee_no1: number | null; 
  administrator_employee_no2: number | null;
  administrator_employee_no3: number | null;
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

  // handleChange 関数の修正
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;

    const isNumberField = [
      "menu_row",
      "administrator_employee_no1",
      "administrator_employee_no2",
      "administrator_employee_no3",
    ].includes(name);

    // 数値フィールドの場合の処理を修正
    const newValue = isNumberField
      ? value === "" // 空文字チェック
        ? null // 👈 空文字の場合は null をセット
        : parseInt(value, 10) // それ以外は整数に変換
      : value;

    setFormData((prevData) => {
      if (!prevData) return null;
      return {
        ...prevData,
        [name]: newValue, // 変換後の値を使用
      } as Admin; // Admin型にキャスト（nullを許容する型に変更済み）
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
      .catch((err) => {
        console.error(error);
        // サーバーが返すエラーメッセージを表示
        if (err.response && err.response.data) {
          setError(err.response.data.error);
        } else {
          setError("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  // ローディング中またはエラー、データがない場合の表示
  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (!formData) {
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

      {error && (
        <div role="alert">{error}</div>
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
            <label htmlFor="menu_row">一覧表示項目数：</label>
            <input
              id="menu_row"
              name="menu_row"
              type="number"
              value={formData.menu_row}
              onChange={handleChange}
            />
            <label htmlFor="administrator_employee_no1">問い合わせ担当者従業員番号1：</label>
            <input
              id="administrator_employee_no1"
              name="administrator_employee_no1"
              type="number"
              value={formData.administrator_employee_no1 ?? ""}
              onChange={handleChange}
            />
            <label htmlFor="administrator_employee_no2">問い合わせ担当者従業員番号2：</label>
            <input
              id="administrator_employee_no2"
              name="administrator_employee_no2"
              type="number"
              value={formData.administrator_employee_no2 ?? ""}
              onChange={handleChange}
            />
            <label htmlFor="administrator_employee_no3">問い合わせ担当者従業員番号3：</label>
            <input
              id="administrator_employee_no3"
              name="administrator_employee_no3"
              type="number"
              value={formData.administrator_employee_no3 ?? ""}
              onChange={handleChange}
            />
            <button type="submit" className="gray_button">編集</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AdminUpdate;