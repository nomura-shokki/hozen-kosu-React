import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/TeamPage/TeamMenu.module.css";

const TeamMenu: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/team_menu/`, {withCredentials: true})
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            navigate("/login");
          } else if (err.response?.status === 403) {
            navigate("/");
          } else {
            setError(err.message);
          }
        } else {
          setError("予期しないエラーが発生しました");
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
      <h1 className={styles["h1-collar"]}>班員MENU</h1>
      <nav className={styles["team-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      <Link to="/team-new" className={styles["team-button1"]}>班員登録</Link>
      <Link to="/team-list" className={styles["team-button2"]}>班員工数履歴</Link>
    </div>
  );
};

export default TeamMenu;