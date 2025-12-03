import React, { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";


interface Member {
  employee_no: number;
  name: string;
}

const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isBackupRunning, setIsBackupRunning] = useState<boolean>(false);
  const navigate = useNavigate();

  axios.defaults.headers.common['X-CSRFToken'] = getCsrfToken(); // CSRFトークンをAxiosヘッダーに追加

  function getCsrfToken() {
    return document.cookie.match(/csrftoken=([^;]*)/)?.[1] || '';
  }

  // 画面ロード時の認証チェック
  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_Loading/`, {withCredentials: true})
      .then(() => {
        setLoading(false);
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [navigate]);

  const startBackup = async () => {
    try {
      setIsBackupRunning(true);
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/member_backup/`, null, {
        withCredentials: true,
      });
      alert(response.data.message);
    } catch (err) {
      console.error(err);
      alert("バックアップの開始に失敗しました。"); // エラーメッセージを表示
    } finally {
      setIsBackupRunning(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error && !isBackupRunning) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <Loading isLoading={isBackupRunning} /> 
      <div className={styles["admin-loading-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {error && (
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{error}</div>
        )}

        <div className={styles["search-bar"]}>
          <label htmlFor="start-asynchronous5">人員データバックアップ：</label>
          <input
            id="start-asynchronous5"
            name="start-asynchronous5"
            type="button"
            value={isBackupRunning ? "実行中..." : "開始"}
            onClick={!isBackupRunning ? startBackup : undefined}
            disabled={isBackupRunning}
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;





