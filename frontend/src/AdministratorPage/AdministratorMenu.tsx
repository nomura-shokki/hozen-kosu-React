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
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_menu/`, {
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
      <h1 className={styles["h1-collar"]}>問い合わせMENU</h1>
      <nav className={styles["inquir-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      <Link to="/inquir-new" className={styles["inquir-button1"]}>問い合わせ</Link>
      <Link to="/inquir-list" className={styles["inquir-button2"]}>問い合わせ履歴</Link>
    </div>
  );
};

export default AdministratorMenu;