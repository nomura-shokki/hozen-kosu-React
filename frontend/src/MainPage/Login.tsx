import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import logo from "../img/TitleRogo.png";
import styles from "../styles/MainPage/Login.module.css";



const Login: React.FC = () => {
  const [employee_no, setNumber] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/login/`,
        { employee_no: Number(employee_no) },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      const data = response.data;

      if (data.status === "success") {
        navigate("/");
      } else {
        setErrorMessage(data.message || "サーバーエラーが発生しました。");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  return (
    <div className={styles["login-wrapper"]}>
      <img src={logo} alt="業務工数システムロゴ" className={styles["login-logo"]} />
      <form 
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        <h2>ログイン</h2>
        <div className={styles["search-bar"]}>
          <label htmlFor="numberInput">従業員番号</label>
          <input
            type="number"
            id="numberInput"
            value={employee_no}
            onChange={(e) => {
              const value = e.target.value;
              setNumber(value === "" ? "" : value);
            }}
            required
            className={styles["input-focus"]}
          />
          {errorMessage && (
            <div role="alert">{errorMessage}</div>
          )}

          <button type="submit" className="blue_button">ログイン</button>
        </div>
      </form>
      <Link to="/help" className={styles["help-button"]}></Link>
    </div>
  );
};

export default Login;