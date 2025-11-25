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
}

interface Admin {
  administrator_employee_no1: number;
  administrator_employee_no2: number;
  administrator_employee_no3: number;
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
}

interface Response {
  login_data: Member;
  admin_data: Admin;
}

const MainMenu: React.FC = () => {
  const [data, setData] = useState<Member | null>(null);
  const [adminData, setAdminData] = useState<Admin | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/main_menu/`, {withCredentials: true})
      .then((response) => {
        const { login_data, admin_data } = response.data;
        setData(login_data);
        setAdminData(admin_data)
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
      <p>こんにちは {data ? data.name : ""}さん</p>
      {adminData && (adminData.administrator_employee_no1 == data?.employee_no || adminData.administrator_employee_no2 == data?.employee_no || adminData.administrator_employee_no3 == data?.employee_no) && (
        <>
          {adminData?.pop_up_id1 && (
            <p><Link to={`/inquir-detail/${adminData?.pop_up_id1}`} className={styles["a-collar"]}>{adminData?.pop_up1}</Link></p>
          )}
          {adminData?.pop_up_id2 && (
            <p><Link to={`/inquir-detail/${adminData?.pop_up_id2}`} className={styles["a-collar"]}>{adminData?.pop_up2}</Link></p>
          )}
          {adminData?.pop_up_id3 && (
            <p><Link to={`/inquir-detail/${adminData?.pop_up_id3}`} className={styles["a-collar"]}>{adminData?.pop_up3}</Link></p>
          )}
          {adminData?.pop_up_id4 && (
            <p><Link to={`/inquir-detail/${adminData?.pop_up_id4}`} className={styles["a-collar"]}>{adminData?.pop_up4}</Link></p>
          )}
          {adminData?.pop_up_id5 && (
            <p><Link to={`/inquir-detail/${adminData?.pop_up_id5}`} className={styles["a-collar"]}>{adminData?.pop_up5}</Link></p>
          )}
        </>
      )}

      {data?.pop_up_id1 && (
        <p><Link to={`/inquir-detail/${data.pop_up_id1}`} className={styles["a-collar"]}>{data ? data.pop_up1 : ""}</Link></p>
      )}
      {data?.pop_up_id2 && (
        <p><Link to={`/inquir-detail/${data.pop_up_id2}`} className={styles["a-collar"]}>{data ? data.pop_up2 : ""}</Link></p>
      )}
      {data?.pop_up_id3 && (
        <p><Link to={`/inquir-detail/${data.pop_up_id3}`} className={styles["a-collar"]}>{data ? data.pop_up3 : ""}</Link></p>
      )}
      {data?.pop_up_id4 && (
        <p><Link to={`/inquir-detail/${data.pop_up_id4}`} className={styles["a-collar"]}>{data ? data.pop_up4 : ""}</Link></p>
      )}
      {data?.pop_up_id5 && (
        <p><Link to={`/inquir-detail/${data.pop_up_id5}`} className={styles["a-collar"]}>{data ? data.pop_up5 : ""}</Link></p>
      )}
      <p>　</p>
      <Link to="/kosu-menu" className={styles["kosu-menu-button"]}>工数MENU</Link>
      <Link to="/def-menu" className={styles["def-menu-button"]}>工数定義区分MENU</Link>
      {data?.authority && (
        <>
          <Link to="/member-menu" className={styles["member-menu-button"]}>人員MENU</Link>
          <Link to="/team-menu" className={styles["team-menu-button"]}>班員MENU</Link>
        </>
      )}
      <Link to="/inquir-menu" className={styles["inquir-menu-button"]}>問い合わせMENU</Link>
      <button onClick={handleLogout} className="blue_button">
        ログアウト
      </button>
    </div>
  );
};

export default MainMenu;