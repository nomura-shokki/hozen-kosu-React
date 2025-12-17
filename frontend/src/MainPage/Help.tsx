import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "../styles/MainPage/Help.module.css";

const Help: React.FC = () => {
  const [isMemberReset, setIsMemberReset] = useState<boolean>(false);
  const [isDefReset, setIsDefReset] = useState<boolean>(false);
  const [isSettingReset, setIsSettingReset] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const navigate = useNavigate();

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, checked } = event.target;
    if (id === "member-reset") {
      setIsMemberReset(checked);
    } else if (id === "def-reset") {
      setIsDefReset(checked);
    } else if (id === "setting-reset") {
      setIsSettingReset(checked);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (!isMemberReset && !isDefReset && !isSettingReset) {
      setErrorMessage("リセットするデータを選択してください。");
      return;
    }

    if (!window.confirm("チェックを入れたデータは全て削除され、初期状態に戻します。本当に実行しますか？")) {
      return;
    }

    axios
      .post(
        `${process.env.REACT_APP_API_BASE_URL}/api/help/`,
        { 
          memberReset: isMemberReset, 
          defReset: isDefReset,
          settingReset: isSettingReset 
        },
        { withCredentials: true }
      )
      .then(() => {
        alert("リセットが完了しました。");
        setErrorMessage("");
        navigate("/login");
      })
      .catch((err) => {
        if (err.response && err.response.data) {
          setErrorMessage(err.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  return (
    <div className={styles["help-wrapper"]}>
      <h1 className={styles["h1-collar"]}>ヘルプ</h1>
      <nav className={styles["help-nav"]}>
        <Link to="/login">ログイン</Link>
      </nav>

      {errorMessage && (
        <div role="alert" style={{ color: "red" }}>{errorMessage}</div>
      )}

      <form 
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        <div className={styles["search-bar"]}>
          <div className={styles["switch-wrapper"]}>
            <label htmlFor="member-reset">人員データリセット:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="member-reset"
                name="member-reset"
                checked={isMemberReset}
                onChange={handleCheckboxChange}
              />
              <span className={styles["toggle-slider"]}></span>
            </label>

            <label htmlFor="def-reset">工数区分定義データリセット:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="def-reset"
                name="def-reset"
                checked={isDefReset}
                onChange={handleCheckboxChange}
              />
              <span className={styles["toggle-slider"]}></span>
            </label>

            <label htmlFor="setting-reset">設定データリセット:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="setting-reset"
                name="setting-reset"
                checked={isSettingReset}
                onChange={handleCheckboxChange}
              />
              <span className={styles["toggle-slider"]}></span>
            </label>
          </div>
          <button type="submit" className="gray_button">書き込み</button>
        </div>
      </form>
      <Link to="/help" className={styles["help-button"]}></Link>
    </div>
  );
};

export default Help;