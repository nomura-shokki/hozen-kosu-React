import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/MemberPage/MemberMenu.module.css";

const MemberMenu: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMemberMenu = async () => {
      try {
        await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/member_menu/`, { withCredentials: true });
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchMemberMenu();
  }, [navigate]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      <h1 className={styles["h1-collar"]}>人員MENU</h1>
      <nav className={styles["member-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      <Link to="/member-new" className={styles["member-button1"]}>人員登録</Link>
      <Link to="/member-list" className={styles["member-button2"]}>人員一覧</Link>
    </div>
  );
};

export default MemberMenu;