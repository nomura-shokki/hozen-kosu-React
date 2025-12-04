import React, { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios"; // 認証チェックのため、一部axiosを保持
import { useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";

// CSRFトークン取得関数
function getCsrfToken() {
  // document.cookieからcsrftokenを取得する
  return document.cookie.match(/csrftoken=([^;]*)/)?.[1] || '';
}

interface Member {
  employee_no: number;
  name: string;
}

// タスク進行状態監視関数（ReactのstartBackup関数内で使用するため、useCallbackとして定義）
const useMonitorTaskStatus = (setIsBackupRunning: (running: boolean) => void, setError: (error: string | null) => void) => {

  // タスク成功時の処理
  const handleSuccess = (data: any) => {
    setIsBackupRunning(false); // 監視停止
    // 提示されたロジック: 成功時、ダウンロード処理を実行
    if (data.file_path) {
        // ダウンロード処理
        const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/download_member_backup`;
        const filePath = data.file_path;
        const link = document.createElement('a'); // 仮想リンク作成
        link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`; // ダウンロードURLを設定
        link.download = ''; // ファイル名はサーバー設定に委ねる
        link.click(); // 仮想リンククリックでダウンロード開始
        alert("バックアップが完了し、ダウンロードが開始されました。");
    } else {
        alert("バックアップは完了しましたが、ファイルのパスが見つかりません。");
    }
  };

  // タスクエラー時の処理
  const handleError = (data: any) => {
    setIsBackupRunning(false); // 監視停止
    const errorMessage = data.message || "バックアップ処理中にエラーが発生しました。";
    setError(errorMessage);
    alert(errorMessage);
  };


  const monitorTaskStatus = useCallback((taskId: string) => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/check_member_backup_status?task_id=${taskId}`;
    
    // ポーリング処理
    const interval = setInterval(() => {
      fetch(endpoint) // 定期的に状態を確認するためにリクエストを送信
        .then(response => response.json()) // レスポンスJSONに変換
        .then(data => {
          if (data.status === 'success') { // タスク成功時
            clearInterval(interval); // 監視停止
            handleSuccess(data); // 成功時の処理を呼び出す
          } else if (data.status === 'error') { // タスクエラー時
            clearInterval(interval); // 監視停止
            handleError(data); // エラー処理を実行
          }
          // "pending" の場合は監視続行
        })
        .catch(err => { // ネットワークエラー時
          clearInterval(interval); // 監視停止
          console.error('Error:', err); // エラーをログに記録
          handleError({ message: "ネットワークエラーが発生しました。" });
        });
    }, 1000); // 1秒間隔でタスク状態確認

    return () => clearInterval(interval); // クリーンアップ関数を返す
  }, [setIsBackupRunning, setError]);

  return monitorTaskStatus;
};

const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isBackupRunning, setIsBackupRunning] = useState<boolean>(false);
  const navigate = useNavigate();

  // axios.defaults.headers.common['X-CSRFToken'] = getCsrfToken(); // 認証チェック用には残しておくか、認証チェックもfetchに置き換える

  // 画面ロード時の認証チェック (axiosを使用)
  useEffect(() => {
    // 提示されたコードから変更なし
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
  
  // タスク監視フックを呼び出し
  const monitorTaskStatus = useMonitorTaskStatus(setIsBackupRunning, setError);


  // バックアップ開始処理 (提示されたロジックに基づいてfetchを使用)
  const startBackup = useCallback(async () => {
    // startBackup関数のロジック
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/member_backup/`;
    
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsBackupRunning(true); // バックアップ実行中フラグをON

    try {
      // サーバーにPOST送信
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        // 提示されたロジックではボディがnullまたはURLエンコードされたデータだったが、
        // 今回の「人員データバックアップ」ではボディなし(空のオブジェクト)を想定
      });
      
      const data = await response.json(); // レスポンスJSONに変換

      // タスク開始成功時の処理
      if (data.taskId) { // taskIdが返ってきたら成功と見なす (元のコードのaxiosのレスポンス形式に合わせる)
        const taskId = data.taskId; 
        monitorTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) { // 提示されたロジックの形式
          const taskId = data.task_id;
          monitorTaskStatus(taskId);
      } else {
        setIsBackupRunning(false); // 実行中フラグをOFF
        const message = data.message || "バックアップの開始に失敗しました。";
        setError(message);
        alert(message); // エラーメッセージ出力
      }
    } catch (err) {
      setIsBackupRunning(false); // 実行中フラグをOFF
      console.error('Error:', err); // エラーを記録
      setError("バックアップの開始中にネットワークエラーが発生しました。");
      alert("バックアップの開始に失敗しました。");
    }
  }, [monitorTaskStatus, setError]); // 依存配列にmonitorTaskStatusを追加


  // ... レンダリングロジック ...

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
            onClick={!isBackupRunning ? startBackup : undefined} // 修正後のstartBackupを使用
            disabled={isBackupRunning}
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;