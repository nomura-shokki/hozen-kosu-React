import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import styles from "../styles/TeamPage/TeamMenu.module.css";

interface TeamMenuData {
  follow_message_list: string[];
  member_data: object;
}

const TeamMenu: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [teamMenuData, setTeamMenuData] = useState<TeamMenuData | null>(null);
  const location = useLocation();
  const redirectedError = location.state?.errorMessage
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        const response = await axios.get<TeamMenuData>(`${process.env.REACT_APP_API_BASE_URL}/api/team_menu/`, { withCredentials: true });
        setTeamMenuData(response.data);
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

    fetchMenuData();
  }, [navigate]);

  const followMessages = teamMenuData?.follow_message_list || [];

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      <h1 className={styles["h1-collar"]}>班員MENU</h1>
      <nav className={styles["team-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>

      {redirectedError && (<div role="alert">{redirectedError}</div>)}

      {followMessages.length > 0 && (
        <div className={styles["follow-messages"]}>
          <h2>お知らせ</h2>
          {followMessages.map((message, index) => (
            <p key={index} className={styles["follow-message-item"]}>{message}</p>
          ))}
        </div>
      )}

      <Link to="/team-new" className={styles["team-button1"]}>班員登録</Link>
      <Link to="/team-list" className={styles["team-button2"]}>班員工数履歴</Link>
      <Link to="/team-calendar" className={styles["team-button3"]}>班員工数入力状況</Link>
      <Link to="/team-overtime" className={styles["team-button4"]}>班員残業</Link>
      <Link to="/team-view" className={styles["team-button5"]}>工数入力状況(全体)</Link>
    </div>
  );
};

export default TeamMenu;