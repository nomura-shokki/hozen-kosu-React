import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../img/MenuRogo.png";
import Note from "../img/Note.png";
import Balance from "../img/Balance.png";
import Personnel from "../img/Personnel.png";
import Team from "../img/Team.png";
import Mail from "../img/Mail.png";
import Setting from "../img/Setting.png";
import LogConsole from "../Components/LogConsole";
import styles from "../styles/MainPage/MainMenu.module.css";

const LOG_CONSOLE_VISIBILITY_KEY = "showLogConsole";

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
  const [showLogConsole, setShowLogConsole] = useState<boolean>(() => {
    const cachedValue = localStorage.getItem(LOG_CONSOLE_VISIBILITY_KEY);
    return cachedValue === 'true'; 
  });

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOG_CONSOLE_VISIBILITY_KEY) {
        setShowLogConsole(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/main_menu/`, { withCredentials: true });
        const { login_data, admin_data } = response.data;
        setData(login_data);
        setAdminData(admin_data);
      } catch (err) {
        console.error("API Error Full Details:", err); // エラー全体をログ出力
        if (axios.isAxiosError(err)) {
          console.error("Status:", err.response?.status);       // 500などのステータスコード
          console.error("Response Data:", err.response?.data);   // サーバーから返ってきたエラー内容（重要！）
          
          if (err.response?.status === 401) {
            navigate("/login");
          } else {
            // サーバーから送られてきたメッセージがあればそれを、なければデフォルトを表示
            const serverMessage = err.response?.data?.message || err.response?.data?.detail || "サーバー内部エラーが発生しました。";
            setError(serverMessage);
          }
        } else {
          setError("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/logout/`, {}, { withCredentials: true });
      navigate("/login");
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["page-container"]}>
      <div className={styles["menu-wrapper"]}>
        <img src={Logo} alt="Menuロゴ" className={styles["Menu-logo"]} />
        <p>こんにちは {data ? data.name : ""}さん</p>
        <div className={styles["alert-area"]}>
          {adminData && (Number(adminData.administrator_employee_no1) === data?.employee_no || Number(adminData.administrator_employee_no2) === data?.employee_no || Number(adminData.administrator_employee_no3) === data?.employee_no) && (
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
        </div>
        <Link to="/kosu-menu" className={styles["kosu-menu-button"]}>
          <img src={Note} alt="工数アイコン" className={styles["icon"]} />
          工数MENU
        </Link>
        <Link to="/def-menu" className={styles["def-menu-button"]}>
          <img src={Balance} alt="工数区分定義アイコン" className={styles["icon"]} />
          工数定義区分MENU
        </Link>
        {data?.authority && (
          <>
            <Link to="/member-menu" className={styles["member-menu-button"]}>
              <img src={Personnel} alt="人員アイコン" className={styles["icon"]} />
              人員MENU
            </Link>
            <Link to="/team-menu" className={styles["team-menu-button"]}>
              <img src={Team} alt="班員アイコン" className={styles["icon"]} />
              班員MENU
            </Link>
          </>
        )}
        <Link to="/inquir-menu" className={styles["inquir-menu-button"]}>
          <img src={Mail} alt="問い合わせアイコン" className={styles["icon"]} />
          問い合わせMENU
        </Link>
        {data?.administrator && (
          <Link to="/manager-menu" className={styles["admin-menu-button"]}>
            <img src={Setting} alt="管理者アイコン" className={styles["icon"]} />
            管理者MENU
          </Link>
        )}
        <button onClick={handleLogout} className="blue_button">
          ログアウト
        </button>
      </div>
      {showLogConsole && <LogConsole />}
    </div>
  );
};

export default MainMenu;