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
// タスク進行状態監視関数（修正案）
// =========================================================================
const useMonitorTaskStatus = (
  setIsRunning: (running: boolean) => void,
  setError: (error: string | null) => void,
  isDelet: boolean = false // ★追加: 削除タスクかどうかを判定するためのフラグ
) => {

  // タスク成功時の処理
  const handleSuccess = (data: any) => { // handleBackupSuccess から handleSuccess に変更
    setIsRunning(false); // 実行中フラグを必ずOFFにする

    // 削除タスクの場合
    if (isDelet) {
      alert("データ削除が完了しました。");
      return;
    }
    
    // バックアップタスクの場合（ダウンロード処理）
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
      alert("処理が完了しました。");
    }
  };

  // タスクエラー時の処理
  const handleError = (data: any) => {
    setIsRunning(false);
    const defaultMessage = isDelet ? "データ削除処理中にエラーが発生しました。" : "データバックアップ処理中にエラーが発生しました。";
    const errorMessage = data.message || defaultMessage;
    setError(errorMessage);
    alert(errorMessage);
  };

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
  }, [setIsRunning, setError, isDelet]); // ★依存配列に isDelet を追加

  return monitorTaskStatus;
};

// =========================================================================
// AdministratorLoading コンポーネント
// =========================================================================
const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isKosuBackupRunning, setIsKosuBackupRunning] = useState<boolean>(false); 
  const [isKosuDeletRunning, setIsKosuDeletRunning] = useState<boolean>(false);
  const [isDefBackupRunning, setIsDefBackupRunning] = useState<boolean>(false); 
  const [isMemberBackupRunning, setIsMemberBackupRunning] = useState<boolean>(false);
  const [isTeamBackupRunning, setIsTeamBackupRunning] = useState<boolean>(false); 
  const [isSettingBackupRunning, setIsSettingBackupRunning] = useState<boolean>(false); 
  const [isAsyncTaskBackupRunning, setIsAsyncTaskBackupRunning] = useState<boolean>(false); 
  const [isAsyncTaskDeletRunning, setIsAsyncTaskDeletRunning] = useState<boolean>(false);
  const [isOperationHistoryBackupRunning, setIsOperationHistoryBackupRunning] = useState<boolean>(false);
  const [isOperationHistoryDeletRunning, setIsOperationHistoryDeletRunning] = useState<boolean>(false);
  const [KosuError, setKosuError] = useState<string | null>(null);
  const [DefError, setDefError] = useState<string | null>(null);
  const [MemberError, setMemberError] = useState<string | null>(null);
  const [TeamError, setTeamError] = useState<string | null>(null); 
  const [SettingError, setSettingError] = useState<string | null>(null);
  const [AsyncTaskError, setAsyncTaskError] = useState<string | null>(null);
  const [OperationHistoryError, setOperationHistoryError] = useState<string | null>(null);
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
  // 工数削除: タスク監視フックを呼び出し
  const monitorKosuDeletTaskStatus = useMonitorTaskStatus(setIsKosuDeletRunning, setKosuError);
  // 工数区分定義バックアップ: タスク監視フックを呼び出し
  const monitorDefTaskStatus = useMonitorTaskStatus(setIsDefBackupRunning, setDefError);
  // 人員バックアップ: タスク監視フックを呼び出し
  const monitorMemberTaskStatus = useMonitorTaskStatus(setIsMemberBackupRunning, setMemberError);
  // 班員バックアップ: タスク監視フックを呼び出し
  const monitorTeamTaskStatus = useMonitorTaskStatus(setIsTeamBackupRunning, setTeamError); 
  // 設定バックアップ: タスク監視フックを呼び出し
  const monitorSettingTaskStatus = useMonitorTaskStatus(setIsSettingBackupRunning, setSettingError);
  // タスク履歴バックアップ: タスク監視フックを呼び出し
  const monitorAsyncTaskTaskStatus = useMonitorTaskStatus(setIsAsyncTaskBackupRunning, setAsyncTaskError);
  // タスク履歴削除: タスク監視フックを呼び出し
  const monitorAsyncTaskDeletTaskStatus = useMonitorTaskStatus(setIsAsyncTaskDeletRunning, setAsyncTaskError);
  // 操作履歴バックアップ: タスク監視フックを呼び出し
  const monitorOperationHistoryTaskStatus = useMonitorTaskStatus(setIsOperationHistoryBackupRunning, setOperationHistoryError);
  // 操作履歴削除: タスク監視フックを呼び出し
  const monitorOperationHistoryDeletTaskStatus = useMonitorTaskStatus(setIsOperationHistoryDeletRunning, setOperationHistoryError);

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
  // 工数削除開始処理
  // =========================================================================
  const startKosuDelet = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/kosu_delet/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // Content-Type ヘッダーを追加
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsKosuDeletRunning(true); // バックアップ実行中フラグをON

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
        monitorKosuDeletTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorKosuDeletTaskStatus(taskId);
      } else {
        setIsKosuDeletRunning(false);
        const message = data.message || "工数データ削除に失敗しました。";
        setKosuError(message);
        alert(message);
      }
    } catch (err) {
      setIsKosuDeletRunning(false);
      console.error('Error:', err);
      setKosuError("工数データ削除中にネットワークエラーが発生しました。");
      alert("工数削除に失敗しました。");
    }
  }, [monitorKosuDeletTaskStatus, setKosuError, startDay, endDay]);

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
  // 班員バックアップ開始処理
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
        const message = data.message || "設定データバックアップの開始に失敗しました。";
        setSettingError(message);
        alert(message);
      }
    } catch (err) {
      setIsSettingBackupRunning(false);
      console.error('Error:', err);
      setSettingError("設定データバックアップの開始中にネットワークエラーが発生しました。");
      alert("設定データバックアップの開始に失敗しました。");
    }
  }, [monitorSettingTaskStatus, setSettingError]);

  // =========================================================================
  // タスク履歴バックアップ開始処理
  // =========================================================================
  const startAsyncTaskBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/AsyncTask_backup/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // Content-Type ヘッダーを追加
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsAsyncTaskBackupRunning(true); // バックアップ実行中フラグをON

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
        monitorAsyncTaskTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorAsyncTaskTaskStatus(taskId);
      } else {
        setIsAsyncTaskBackupRunning(false);
        const message = data.message || "タスク履歴データバックアップの開始に失敗しました。";
        setAsyncTaskError(message);
        alert(message);
      }
    } catch (err) {
      setIsAsyncTaskBackupRunning(false);
      console.error('Error:', err);
      setAsyncTaskError("タスク履歴データバックアップの開始中にネットワークエラーが発生しました。");
      alert("タスク履歴データバックアップの開始に失敗しました。");
    }
  }, [monitorAsyncTaskTaskStatus, setAsyncTaskError, startDay, endDay]);

  // =========================================================================
  // タスク履歴削除開始処理
  // =========================================================================
  const startAsyncTaskDelet = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/AsyncTask_delet/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // Content-Type ヘッダーを追加
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsAsyncTaskDeletRunning(true); // バックアップ実行中フラグをON

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
        monitorAsyncTaskDeletTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorAsyncTaskDeletTaskStatus(taskId);
      } else {
        setIsAsyncTaskDeletRunning(false);
        const message = data.message || "タスク履歴データ削除に失敗しました。";
        setAsyncTaskError(message);
        alert(message);
      }
    } catch (err) {
      setIsAsyncTaskDeletRunning(false);
      console.error('Error:', err);
      setAsyncTaskError("タスク履歴データ削除中にネットワークエラーが発生しました。");
      alert("タスク履歴削除に失敗しました。");
    }
  }, [monitorAsyncTaskDeletTaskStatus, setAsyncTaskError, startDay, endDay]);

  // =========================================================================
  // 操作履歴バックアップ開始処理
  // =========================================================================
  const startOperationHistoryBackup = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/Operation_history_backup/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // Content-Type ヘッダーを追加
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsOperationHistoryBackupRunning(true); // バックアップ実行中フラグをON

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
        monitorOperationHistoryTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorOperationHistoryTaskStatus(taskId);
      } else {
        setIsOperationHistoryBackupRunning(false);
        const message = data.message || "操作履歴データバックアップの開始に失敗しました。";
        setOperationHistoryError(message);
        alert(message);
      }
    } catch (err) {
      setIsOperationHistoryBackupRunning(false);
      console.error('Error:', err);
      setOperationHistoryError("操作履歴データバックアップの開始中にネットワークエラーが発生しました。");
      alert("操作履歴データバックアップの開始に失敗しました。");
    }
  }, [monitorOperationHistoryTaskStatus, setOperationHistoryError, startDay, endDay]);

  // =========================================================================
  // 操作履歴削除開始処理
  // =========================================================================
  const startOperationHistoryDelet = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/Operation_history_delet/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // Content-Type ヘッダーを追加
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    setIsOperationHistoryDeletRunning(true); // バックアップ実行中フラグをON

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
        monitorOperationHistoryDeletTaskStatus(taskId); // タスク監視関数を呼び出し
      } else if (data.status === 'success' && data.task_id) {
          const taskId = data.task_id;
          monitorOperationHistoryDeletTaskStatus(taskId);
      } else {
        setIsOperationHistoryDeletRunning(false);
        const message = data.message || "操作履歴データ削除に失敗しました。";
        setOperationHistoryError(message);
        alert(message);
      }
    } catch (err) {
      setIsOperationHistoryDeletRunning(false);
      console.error('Error:', err);
      setOperationHistoryError("操作履歴データ削除中にネットワークエラーが発生しました。");
      alert("操作履歴削除に失敗しました。");
    }
  }, [monitorOperationHistoryDeletTaskStatus, setOperationHistoryError, startDay, endDay]);

  // ローディング表示の条件に両方のバックアップ状態を追加
  const isAnyBackupRunning = isKosuBackupRunning || isKosuDeletRunning || isDefBackupRunning || isMemberBackupRunning || isTeamBackupRunning || isSettingBackupRunning || isAsyncTaskBackupRunning || isAsyncTaskDeletRunning || isOperationHistoryBackupRunning;

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

        {(MemberError || TeamError || KosuError || DefError || SettingError || AsyncTaskError || OperationHistoryError) && !isAnyBackupRunning && ( 
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{MemberError || TeamError || KosuError || DefError || SettingError || AsyncTaskError || OperationHistoryError}</div>
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
          <label htmlFor="start-asynchronous1">工数データ：</label>
          <input
            id="start-asynchronous1"
            name="start-asynchronous1"
            type="button"
            value={isKosuBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startKosuBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-asynchronous1"
            name="start-asynchronous1"
            type="button"
            value={isKosuDeletRunning ? "実行中..." : "削除開始"} 
            onClick={!isAnyBackupRunning ? startKosuDelet : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous2">工数区分定義データ：</label>
          <input
            id="start-asynchronous2"
            name="start-asynchronous2"
            type="button"
            value={isDefBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startDefBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous3">人員データ：</label>
          <input
            id="start-asynchronous3"
            name="start-asynchronous3"
            type="button"
            value={isMemberBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startMemberBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous4">班員データ：</label>
          <input
            id="start-asynchronous4"
            name="start-asynchronous4"
            type="button"
            value={isTeamBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startTeamBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous5">設定データ：</label>
          <input
            id="start-asynchronous5"
            name="start-asynchronous5"
            type="button"
            value={isSettingBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startSettingBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous6">タスク履歴データ：</label>
          <input
            id="start-asynchronous6"
            name="start-asynchronous6"
            type="button"
            value={isAsyncTaskBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startAsyncTaskBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-asynchronous6"
            name="start-asynchronous6"
            type="button"
            value={isAsyncTaskDeletRunning ? "実行中..." : "削除開始"} 
            onClick={!isAnyBackupRunning ? startAsyncTaskDelet : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous7">操作履歴データ：</label>
          <input
            id="start-asynchronous7"
            name="start-asynchronous7"
            type="button"
            value={isOperationHistoryBackupRunning ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startOperationHistoryBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-asynchronous7"
            name="start-asynchronous7"
            type="button"
            value={isOperationHistoryDeletRunning ? "実行中..." : "削除開始"} 
            onClick={!isAnyBackupRunning ? startOperationHistoryDelet : undefined} 
            disabled={isAnyBackupRunning} 
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;