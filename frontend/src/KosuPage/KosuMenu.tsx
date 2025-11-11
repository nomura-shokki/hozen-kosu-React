import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/KosuPage/KosuMenu.module.css";



interface Member {
  employee_no: number;
  name: string;
}

const KosuMenu: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Member[]>(`${process.env.REACT_APP_API_BASE_URL}/api/kosu_menu/`, {
        withCredentials: true,
      })
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(err.message);
        }
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
      <h1 className={styles["h1-collar"]}>工数MENU</h1>
      <nav className={styles["kosu-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      <Link to="/kosu-new" className={styles["kosu-button1"]}>工数入力</Link>
      <Link to="/kosu-list" className={styles["kosu-button2"]}>工数履歴</Link>
      <Link to="/break-time" className={styles["kosu-button3"]}>休憩変更</Link>
      <Link to="/kosu-calendar" className={styles["kosu-button4"]}>勤務入力</Link>
      <Link to="/kosu-total" className={styles["kosu-button5"]}>工数集計</Link>
    </div>
  );
};

export default KosuMenu;