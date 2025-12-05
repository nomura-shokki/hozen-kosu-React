import React, { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios"; // 認証チェックのため、一部axiosを保持
import { useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";

// 今日の日付を取得する関数
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
const useMonitorTaskStatus = (setIsRunning: (running: boolean) => void, setError: (error: string | null) => void) => {

  // タスク成功時の処理
  const handleSuccess = (data: any) => {
    setIsRunning(false);
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
    setIsRunning(false);
    const errorMessage = data.message || "データバックアップ処理中にエラーが発生しました。";
    setError(errorMessage);
    alert(errorMessage);
  };

  // 関数名を monitorMemberTaskStatus から monitorTaskStatus へ変更（任意だが、汎用化）
  const monitorTaskStatus = useCallback((taskId: string) => {
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
  }, [setIsRunning, setError]); // 依存配列も更新 (setIsMemberBackupRunning, setMemberError -> setIsRunning, setError)

  return monitorTaskStatus; // monitorMemberTaskStatus -> monitorTaskStatus に変更
};

// =========================================================================
// AdministratorLoading コンポーネント
// =========================================================================
const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isKosuBackupRunning, setIsKosuBackupRunning] = useState<boolean>(false); 
  const [isDefBackupRunning, setIsDefBackupRunning] = useState<boolean>(false); 
  const [isMemberBackupRunning, setIsMemberBackupRunning] = useState<boolean>(false);
  const [isTeamBackupRunning, setIsTeamBackupRunning] = useState<boolean>(false); 
  const [isSettingBackupRunning, setIsSettingBackupRunning] = useState<boolean>(false); 
  const [KosuError, setKosuError] = useState<string | null>(null);
  const [DefError, setDefError] = useState<string | null>(null);
  const [MemberError, setMemberError] = useState<string | null>(null);
  const [TeamError, setTeamError] = useState<string | null>(null); 
  const [SettingError, setSettingError] = useState<string | null>(null);
  const today = getTodayDateString();
  const [startDay, setStartDay] = useState<string>(today);
  const [endDay, setEndDay] = useState<string>(today);
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
  // 工数区分定義バックアップ: タスク監視フックを呼び出し
  const monitorDefTaskStatus = useMonitorTaskStatus(setIsDefBackupRunning, setDefError);
  // 人員バックアップ: タスク監視フックを呼び出し
  const monitorMemberTaskStatus = useMonitorTaskStatus(setIsMemberBackupRunning, setMemberError);
  // 班員バックアップ: タスク監視フックを呼び出し
  const monitorTeamTaskStatus = useMonitorTaskStatus(setIsTeamBackupRunning, setTeamError); 
  // 設定バックアップ: タスク監視フックを呼び出し
  const monitorSettingTaskStatus = useMonitorTaskStatus(setIsSettingBackupRunning, setSettingError);

  // =========================================================================
  // 工数バックアップ開始処理
  // =========================================================================
  const startKosuBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/kosu_backup/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // Content-Type ヘッダーを追加
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsKosuBackupRunning(true); // バックアップ実行中フラグをON

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          start_day: startDay,
          end_day: endDay,
        }),
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
        const message = data.message || "工数データバックアップの開始に失敗しました。";
        setKosuError(message);
        alert(message);
      }
    } catch (err) {
      setIsKosuBackupRunning(false);
      console.error('Error:', err);
      setKosuError("工数データバックアップの開始中にネットワークエラーが発生しました。");
      alert("工数データバックアップの開始に失敗しました。");
    }
  }, [monitorKosuTaskStatus, setKosuError, startDay, endDay]);

  // =========================================================================
  // 工数区分定義バックアップ開始処理
  // =========================================================================
  const startDefBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/def_backup/`;
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsDefBackupRunning(true); // バックアップ実行中フラグをON

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
      });
      const data = await response.json();

      // タスク開始成功時の処理
      if (data.taskId) {
        const taskId = data.taskId; 
        monitorDefTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorDefTaskStatus(taskId);
      } else {
        setIsDefBackupRunning(false);
        const message = data.message || "工数区分定義データバックアップの開始に失敗しました。";
        setDefError(message);
        alert(message);
      }
    } catch (err) {
      setIsDefBackupRunning(false);
      console.error('Error:', err);
      setDefError("工数区分定義データバックアップの開始中にネットワークエラーが発生しました。");
      alert("工数区分定義データバックアップの開始に失敗しました。");
    }
  }, [monitorDefTaskStatus, setDefError]);

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

  // =========================================================================
  // 設定バックアップ開始処理
  // =========================================================================
  const startSettingBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/setting_backup/`;
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsSettingBackupRunning(true); // バックアップ実行中フラグをON

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
      });
      const data = await response.json();

      // タスク開始成功時の処理
      if (data.taskId) {
        const taskId = data.taskId; 
        monitorSettingTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorSettingTaskStatus(taskId);
      } else {
        setIsSettingBackupRunning(false);
        const message = data.message || "人員データバックアップの開始に失敗しました。";
        setSettingError(message);
        alert(message);
      }
    } catch (err) {
      setIsSettingBackupRunning(false);
      console.error('Error:', err);
      setSettingError("人員データバックアップの開始中にネットワークエラーが発生しました。");
      alert("人員データバックアップの開始に失敗しました。");
    }
  }, [monitorSettingTaskStatus, setSettingError]);

  // ローディング表示の条件に両方のバックアップ状態を追加
  const isAnyBackupRunning = isKosuBackupRunning || isDefBackupRunning || isMemberBackupRunning || isTeamBackupRunning || isSettingBackupRunning;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Loading isLoading={isAnyBackupRunning} /> 
      <div className={styles["admin-loading-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {(MemberError || TeamError || KosuError || DefError || SettingError) && !isAnyBackupRunning && ( 
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{MemberError || TeamError || KosuError || DefError || SettingError}</div>
        )}
        
        <div className={styles["search-bar"]}>
          <input
            type="date"
            id="start_day"
            name="start_day"
            value={startDay}
            onChange={(e) => setStartDay(e.target.value)}
          />
          ～
          <input
            type="date"
            id="end_day"
            name="end_day"
            value={endDay}
            onChange={(e) => setEndDay(e.target.value)}
          />
          <label htmlFor="start-asynchronous1">工数データバックアップ：</label>
          <input
            id="start-asynchronous1"
            name="start-asynchronous1"
            type="button"
            value={isKosuBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startKosuBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-asynchronous1"
            name="start-asynchronous1"
            type="button"
            value={isKosuBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startKosuBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous2">工数区分定義データバックアップ：</label>
          <input
            id="start-asynchronous2"
            name="start-asynchronous2"
            type="button"
            value={isDefBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startDefBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous3">人員データバックアップ：</label>
          <input
            id="start-asynchronous3"
            name="start-asynchronous3"
            type="button"
            value={isMemberBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startMemberBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous4">班員データバックアップ：</label>
          <input
            id="start-asynchronous4"
            name="start-asynchronous4"
            type="button"
            value={isTeamBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startTeamBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous5">設定データバックアップ：</label>
          <input
            id="start-asynchronous5"
            name="start-asynchronous5"
            type="button"
            value={isSettingBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startSettingBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;