import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import styles from "../styles/MemberPage/MemberMenu.module.css";



interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
  break_time1: string;
  break_time1_over1: string;
  break_time1_over2: string;
  break_time1_over3: string;
  break_time2: string;
  break_time2_over1: string;
  break_time2_over2: string;
  break_time2_over3: string;
  break_time3: string;
  break_time3_over1: string;
  break_time3_over2: string;
  break_time3_over3: string;
  break_time4: string;
  break_time4_over1: string;
  break_time4_over2: string;
  break_time4_over3: string;
  break_time5: string;
  break_time5_over1: string;
  break_time5_over2: string;
  break_time5_over3: string;
  break_time6: string;
  break_time6_over1: string;
  break_time6_over2: string;
  break_time6_over3: string;
  pop_up1: string;
  pop_up_id1: string;
  pop_up2: string;
  pop_up_id2: string;
  pop_up3: string;
  pop_up_id3: string;
  pop_up4: string;
  pop_up_id4: string;
  pop_up5: string;
  pop_up_id5: string;
  break_check: boolean;
  def_prediction: boolean;
}

const MemberMenu: React.FC = () => {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Member[]>(`${process.env.REACT_APP_API_BASE_URL}/api/member_menu/`, {
        withCredentials: true, // クッキーをリクエストに含める設定
      })
      .then((response) => {
        setData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate('/');
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