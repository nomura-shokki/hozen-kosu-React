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

// =========================================================================
// タスク進行状態監視関数
// =========================================================================
const useMonitorTaskStatus = (setIsMemberBackupRunning: (running: boolean) => void, setMemberError: (error: string | null) => void) => {

  // タスク成功時の処理
  const handleSuccess = (data: any) => {
    setIsMemberBackupRunning(false); // 監視停止
    // 提示されたロジック: 成功時、ダウンロード処理を実行
    if (data.file_path) {
      // ダウンロード処理
      const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/download_backup`;
      const filePath = data.file_path;
      const link = document.createElement('a'); // 仮想リンク作成
      link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`; // ダウンロードURLを設定
      link.download = ''; // ファイル名はサーバー設定に委ねる
      link.click(); // 仮想リンククリックでダウンロード開始
      alert("データバックアップが完了し、ダウンロードが開始されました。");
    } else {
      alert("データバックアップは完了しましたが、ファイルのパスが見つかりません。");
    }
  };

  // タスクエラー時の処理
  const handleError = (data: any) => {
    setIsMemberBackupRunning(false); // 監視停止
    const errorMessage = data.message || "データバックアップ処理中にエラーが発生しました。";
    setMemberError(errorMessage);
    alert(errorMessage);
  };

  const monitorMemberTaskStatus = useCallback((taskId: string) => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/check_backup_status?task_id=${taskId}`;
    
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
        })
        .catch(err => { // ネットワークエラー時
          clearInterval(interval); // 監視停止
          console.error('Error:', err); // エラーをログに記録
          handleError({ message: "ネットワークエラーが発生しました。" });
        });
    }, 1000); // 1秒間隔でタスク状態確認

    return () => clearInterval(interval); // クリーンアップ関数を返す
  }, [setIsMemberBackupRunning, setMemberError]);

  return monitorMemberTaskStatus;
};

// =========================================================================
// AdministratorLoading コンポーネント
// =========================================================================
const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isKosuBackupRunning, setIsKosuBackupRunning] = useState<boolean>(false); 
  const [isMemberBackupRunning, setIsMemberBackupRunning] = useState<boolean>(false); // 人員バックアップの状態
  const [isTeamBackupRunning, setIsTeamBackupRunning] = useState<boolean>(false); 
  const [KosuError, setKosuError] = useState<string | null>(null);
  const [MemberError, setMemberError] = useState<string | null>(null);
  const [TeamError, setTeamError] = useState<string | null>(null); 
  
  const navigate = useNavigate();

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
          setMemberError(err.message);
        }
        setLoading(false);
      });
  }, [navigate]);
  
  // 工数バックアップ: タスク監視フックを呼び出し
  const monitorKosuTaskStatus = useMonitorTaskStatus(setIsKosuBackupRunning, setKosuError);
  // 人員バックアップ: タスク監視フックを呼び出し
  const monitorMemberTaskStatus = useMonitorTaskStatus(setIsMemberBackupRunning, setMemberError);
  // 班員バックアップ: タスク監視フックを呼び出し
  const monitorTeamTaskStatus = useMonitorTaskStatus(setIsTeamBackupRunning, setTeamError); 

  // =========================================================================
  // 工数バックアップ開始処理
  // =========================================================================
  const startKosuBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/kosu_backup/`;
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsKosuBackupRunning(true); // バックアップ実行中フラグをON

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
      });
      const data = await response.json();

      // タスク開始成功時の処理
      if (data.taskId) {
        const taskId = data.taskId; 
        monitorKosuTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorKosuTaskStatus(taskId);
      } else {
        setIsKosuBackupRunning(false);
        const message = data.message || "人員データバックアップの開始に失敗しました。";
        setKosuError(message);
        alert(message);
      }
    } catch (err) {
      setIsKosuBackupRunning(false);
      console.error('Error:', err);
      setKosuError("人員データバックアップの開始中にネットワークエラーが発生しました。");
      alert("人員データバックアップの開始に失敗しました。");
    }
  }, [monitorKosuTaskStatus, setKosuError]);

  // =========================================================================
  // 人員バックアップ開始処理
  // =========================================================================
  const startMemberBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/member_backup/`;
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsMemberBackupRunning(true); // バックアップ実行中フラグをON

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
      });
      const data = await response.json();

      // タスク開始成功時の処理
      if (data.taskId) {
        const taskId = data.taskId; 
        monitorMemberTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorMemberTaskStatus(taskId);
      } else {
        setIsMemberBackupRunning(false);
        const message = data.message || "人員データバックアップの開始に失敗しました。";
        setMemberError(message);
        alert(message);
      }
    } catch (err) {
      setIsMemberBackupRunning(false);
      console.error('Error:', err);
      setMemberError("人員データバックアップの開始中にネットワークエラーが発生しました。");
      alert("人員データバックアップの開始に失敗しました。");
    }
  }, [monitorMemberTaskStatus, setMemberError]);

  // =========================================================================
  // 班員バックアップ開始処理 (startTeamBackup)
  // =========================================================================
  const startTeamBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/team_backup/`; 
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsTeamBackupRunning(true); 

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
      });
      
      const data = await response.json();

      // タスク開始成功時の処理
      if (data.taskId) { 
        const taskId = data.taskId; 
        // 班員タスク監視関数を呼び出し
        monitorTeamTaskStatus(taskId); 
      } else if (data.status === 'success' && data.task_id) { 
          const taskId = data.task_id;
          // 班員タスク監視関数を呼び出し
          monitorTeamTaskStatus(taskId);
      } else {
        // 班員実行中フラグをOFF
        setIsTeamBackupRunning(false); 
        // エラーメッセージ
        const message = data.message || "班員データバックアップの開始に失敗しました。"; 
        setTeamError(message);
        alert(message);
      }
    } catch (err) {
      // 班員実行中フラグをOFF
      setIsTeamBackupRunning(false); 
      console.error('Error:', err);
      setTeamError("班員データバックアップの開始中にネットワークエラーが発生しました。"); 
      alert("班員データバックアップの開始に失敗しました。");
    }
  }, [monitorTeamTaskStatus, setTeamError]);

  // ローディング表示の条件に両方のバックアップ状態を追加
  const isAnyBackupRunning = isKosuBackupRunning || isMemberBackupRunning || isTeamBackupRunning;

  if (loading) {
    return <div>Loading...</div>;
  }

  if ((MemberError || TeamError || KosuError) && !isAnyBackupRunning) {
    return <div>Error: {MemberError || TeamError || KosuError}</div>;
  }

  return (
    <>
      <Loading isLoading={isAnyBackupRunning} /> 
      <div className={styles["admin-loading-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {(MemberError || TeamError || KosuError) && !isAnyBackupRunning && ( 
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{MemberError || TeamError || KosuError}</div>
        )}
        
        <div className={styles["search-bar"]}>
          <label htmlFor="start-asynchronous1">工数データバックアップ：</label>
          <input
            type="date"
            id="start_day"
            name="start_day"
          />
          ～
          <input
            type="date"
            id="end_day"
            name="end_day"
          />
          <input
            id="start-asynchronous1"
            name="start-asynchronous1"
            type="button"
            value={isKosuBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startKosuBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous2">人員データバックアップ：</label>
          <input
            id="start-asynchronous2"
            name="start-asynchronous2"
            type="button"
            value={isMemberBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startMemberBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous3">班員データバックアップ：</label>
          <input
            id="start-asynchronous3"
            name="start-asynchronous3"
            type="button"
            value={isTeamBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startTeamBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;