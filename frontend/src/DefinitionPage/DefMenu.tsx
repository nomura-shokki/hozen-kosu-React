import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/DefinitionPage/DefMenu.module.css";



interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

const DefMenu: React.FC = () => {
  const [data, setData] = useState<Member | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<Member>(
          `${process.env.REACT_APP_API_BASE_URL}/api/def_menu/`,
          { withCredentials: true }
        );
        setData(response.data);
        setLoading(false);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else setError(err.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数区分定義MENU</h1>
      <nav className={styles["def-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      <Link to="/def-search" className={styles["def-button1"]}>工数区分定義確認</Link>
      {data?.administrator && (
        <>
          <Link to="/def-new" className={styles["def-button2"]}>工数区分定義登録</Link>
          <Link to="/def-list" className={styles["def-button3"]}>工数区分定義一覧</Link>
        </>
      )}
      <Link to="/def-ver" className={styles["def-button4"]}>工数区分定義切り替え</Link>
    </div>
  );
};

export default DefMenu;