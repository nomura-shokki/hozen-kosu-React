import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/AdministratorPage/AdministratorMenu.module.css";



interface Member {
  employee_no: number;
  name: string;
}

const AdministratorMenu: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_menu/`, {
        withCredentials: true,
      })
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
          setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className={styles["menu-wrapper"]}>
      <h1 className={styles["h1-collar"]}>管理者MENU</h1>
      <nav className={styles["admin-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      <Link to="/manager-update" className={styles["admin-button1"]}>設定変更</Link>
      <Link to="/manager-loading" className={styles["admin-button2"]}>データ管理</Link>
      <Link to="/manager-kosu" className={styles["admin-button3"]}>全工数データ管理</Link>
      <Link to="/manager-task" className={styles["admin-button4"]}>非同期タスクデータ管理</Link>
      <Link to="/manager-history" className={styles["admin-button5"]}>データ操作履歴管理</Link>
    </div>
  );
};

export default AdministratorMenu;