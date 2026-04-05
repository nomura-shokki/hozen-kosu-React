import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";
import styles from "../styles/MainPage/Help.module.css";

const Help: React.FC = () => {
  const [isMemberReset, setIsMemberReset] = useState<boolean>(false);
  const [isDefReset, setIsDefReset] = useState<boolean>(false);
  const [isSettingReset, setIsSettingReset] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
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

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const res = await api.post("/api/help_pass/", { password });
      if (res.data === true || res.data.result === true) {
        setIsAuthenticated(true);
      } else {
        setErrorMessage("認証に失敗しました。");
      }
    } catch (error) {
      setErrorMessage("認証エラーが発生しました。");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (!isMemberReset && !isDefReset && !isSettingReset) {
      setErrorMessage("リセットするデータを選択してください。");
      return;
    }

    if (!confirm("チェックを入れたデータは全て削除され、初期状態に戻します。本当に実行しますか？")) {
      return;
    }

    try {
      await api.post("/api/help//", { 
        memberReset: isMemberReset, 
        defReset: isDefReset,
        settingReset: isSettingReset 
      });

      if (isMemberReset) {
        alert("リセットが完了しました。従業員番号：12345でログイン可能です。");
      } else {
        alert("リセットが完了しました。");
      }
      setErrorMessage("");
      navigate("/login");
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles["help-wrapper"]}>
        <h1 className={styles["h1-collar"]}>認証</h1>
        <nav className={styles["help-nav"]}>
          <Link to="/login">ログイン</Link>
        </nav>
        {errorMessage && (
          <div role="alert" style={{ color: "red" }}>{errorMessage}</div>
        )}
        <form onSubmit={handlePasswordSubmit}>
          <div className={styles["search-bar"]}>
            <input
              type="password"
              placeholder="パスワードを入力してください"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="gray_button">認証</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={styles["help-wrapper"]}>
      <h1 className={styles["h1-collar"]}>ヘルプ</h1>
      <nav className={styles["help-nav"]}>
        <Link to="/login">ログイン</Link>
      </nav>

      {errorMessage && (
        <div role="alert" style={{ color: "red" }}>{errorMessage}</div>
      )}

      <p>下記データの内、リセットの必要のあるデータを選択して下さい。</p>
      <p>(選択したデータは全て消え、デフォルトのデータが1件入ります。)</p>

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