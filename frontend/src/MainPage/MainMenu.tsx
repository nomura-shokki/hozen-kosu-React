import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import logo from "../img/MenuRogo.png";
import styles from "../styles/MainPage/MainMenu.module.css";



interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
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
      .get<Member[]>(`${process.env.REACT_APP_API_BASE_URL}/api/main_menu/`, {withCredentials: true})
      .then((response) => {
        setData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          // ユーザーが未認証の場合はログイン画面にリダイレクト
          navigate("/login");
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/logout/`, {}, {withCredentials: true});
      navigate("/login");
    } catch (error) {
      console.error("ログアウト中にエラーが発生しました。", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className={styles["menu-wrapper"]}>
      <img src={logo} alt="Menuロゴ" className={styles["Menu-logo"]} />
      <p>こんにちは {data.length > 0 ? data[0].name : ""}さん</p>
      <p>　</p>
      <Link to="/kosu-menu" className={styles["kosu-menu-button"]}>工数MENU</Link>
      <Link to="/def-menu" className={styles["def-menu-button"]}>工数定義区分MENU</Link>
      {data.length > 0 && data[0].authority && (
        <>
          <Link to="/member-menu" className={styles["member-menu-button"]}>人員MENU</Link>
          <Link to="/team-menu" className={styles["team-menu-button"]}>班員MENU</Link>
        </>
      )}
      <button onClick={handleLogout} className="blue_button">
        ログアウト
      </button>
    </div>
  );
};

export default MemberMenu;