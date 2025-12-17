import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../styles/components/LogConsole.module.css";


const LogConsole: React.FC = () => {
  const [logContent, setLogContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ログを取得するAPIエンドポイント
    const logApiUrl = `${process.env.REACT_APP_API_BASE_URL}/api/web_console_log/`;

    const fetchLog = () => {
      axios
        .get<{ log_content: string }>(logApiUrl, { withCredentials: true })
        .then((response) => {
          setLogContent(response.data.log_content);
          setLoading(false);
        })
        .catch((err) => {
          console.error("ログの取得中にエラー:", err);
          setError("ログの読み込みに失敗しました。");
          setLoading(false);
        });
    };

    fetchLog();
    const intervalId = setInterval(fetchLog, 5000); 

    // クリーンアップ関数
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className={styles.consoleContainer}>
      {loading && <div className={styles.loading}>Loading log...</div>}
      {error && <div className={styles.error}>{error}</div>}

      <pre className={styles.consoleOutput}>
        {logContent || (loading ? "" : "ログファイルは空です。")}
      </pre>
    </div>
  );
};

export default LogConsole;