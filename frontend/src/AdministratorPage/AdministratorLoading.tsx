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
// 人員データバックアップ用: タスク進行状態監視関数（useMonitorTaskStatus）
// エンドポイント: /api/check_member_backup_status, /api/download_member_backup
// =========================================================================
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
      alert("人員データバックアップが完了し、ダウンロードが開始されました。");
    } else {
      alert("人員データバックアップは完了しましたが、ファイルのパスが見つかりません。");
    }
  };

  // タスクエラー時の処理
  const handleError = (data: any) => {
    setIsBackupRunning(false); // 監視停止
    const errorMessage = data.message || "人員データバックアップ処理中にエラーが発生しました。";
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

// =========================================================================
// 班員データバックアップ用: タスク進行状態監視関数（useMonitorTeamTaskStatus）
// エンドポイント: /api/check_team_backup_status, /api/download_team_backup
// ※ useMonitorTaskStatusをコピーし、エンドポイントとalertメッセージを変更
// =========================================================================
const useMonitorTeamTaskStatus = (setIsTeamBackupRunning: (running: boolean) => void, setTeamError: (error: string | null) => void) => {

  // タスク成功時の処理
  const handleSuccess = (data: any) => {
    setIsTeamBackupRunning(false); // 監視停止
    // 提示されたロジック: 成功時、ダウンロード処理を実行
    if (data.file_path) {
      // ダウンロード処理
      // ★変更点: エンドポイントを/api/download_team_backupに
      const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/download_team_backup`; 
      const filePath = data.file_path;
      const link = document.createElement('a'); // 仮想リンク作成
      link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`; // ダウンロードURLを設定
      link.download = ''; // ファイル名はサーバー設定に委ねる
      link.click(); // 仮想リンククリックでダウンロード開始
      // ★変更点: alertメッセージ
      alert("班員データバックアップが完了し、ダウンロードが開始されました。"); 
    } else {
      // ★変更点: alertメッセージ
      alert("班員データバックアップは完了しましたが、ファイルのパスが見つかりません。"); 
    }
  };

  // タスクエラー時の処理
  const handleError = (data: any) => {
    setIsTeamBackupRunning(false); // 監視停止
    // ★変更点: エラーメッセージ
    const errorMessage = data.message || "班員データバックアップ処理中にエラーが発生しました。"; 
    setTeamError(errorMessage);
    alert(errorMessage);
  };


  const monitorTaskStatus = useCallback((taskId: string) => {
    // ★変更点: エンドポイントを/api/check_team_backup_statusに
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/check_team_backup_status?task_id=${taskId}`; 
    
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
  }, [setIsTeamBackupRunning, setTeamError]);

  return monitorTaskStatus;
};

// =========================================================================
// AdministratorLoading コンポーネント
// =========================================================================
const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // 人員バックアップのエラー
  const [isBackupRunning, setIsBackupRunning] = useState<boolean>(false); // 人員バックアップの状態
  // ★追加: 班員バックアップの状態とエラー
  const [isTeamBackupRunning, setIsTeamBackupRunning] = useState<boolean>(false); 
  const [teamError, setTeamError] = useState<string | null>(null); 
  
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
          setError(err.message);
        }
        setLoading(false);
      });
  }, [navigate]);
  
  // 人員バックアップ: タスク監視フックを呼び出し
  const monitorTaskStatus = useMonitorTaskStatus(setIsBackupRunning, setError);
  // ★追加: 班員バックアップ: タスク監視フックを呼び出し
  const monitorTeamTaskStatus = useMonitorTeamTaskStatus(setIsTeamBackupRunning, setTeamError); 

  // =========================================================================
  // 人員バックアップ開始処理 (startBackup)
  // エンドポイント: /api/member_backup/
  // =========================================================================
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
        const message = data.message || "人員データバックアップの開始に失敗しました。";
        setError(message);
        alert(message); // エラーメッセージ出力
      }
    } catch (err) {
      setIsBackupRunning(false); // 実行中フラグをOFF
      console.error('Error:', err); // エラーを記録
      setError("人員データバックアップの開始中にネットワークエラーが発生しました。");
      alert("人員データバックアップの開始に失敗しました。");
    }
  }, [monitorTaskStatus, setError]); // 依存配列にmonitorTaskStatusを追加


  // =========================================================================
  // ★追加: 班員バックアップ開始処理 (startTeamBackup)
  // エンドポイント: /api/team_backup/
  // =========================================================================
  const startTeamBackup = useCallback(async () => {
    // startBackup関数のロジック
    // ★変更点: エンドポイントを/api/team_backup/に
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/team_backup/`; 
    
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
    };

    // ★変更点: 班員バックアップ実行中フラグをON
    setIsTeamBackupRunning(true); 

    try {
      // サーバーにPOST送信
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        // ボディなし(空のオブジェクト)を想定
      });
      
      const data = await response.json(); // レスポンスJSONに変換

      // タスク開始成功時の処理
      if (data.taskId) { 
        const taskId = data.taskId; 
        // ★変更点: 班員タスク監視関数を呼び出し
        monitorTeamTaskStatus(taskId); 
      } else if (data.status === 'success' && data.task_id) { 
          const taskId = data.task_id;
          // ★変更点: 班員タスク監視関数を呼び出し
          monitorTeamTaskStatus(taskId);
      } else {
        // ★変更点: 班員実行中フラグをOFF
        setIsTeamBackupRunning(false); 
        // ★変更点: エラーメッセージ
        const message = data.message || "班員データバックアップの開始に失敗しました。"; 
        setTeamError(message);
        alert(message); // エラーメッセージ出力
      }
    } catch (err) {
      // ★変更点: 班員実行中フラグをOFF
      setIsTeamBackupRunning(false); 
      console.error('Error:', err); // エラーを記録
      // ★変更点: エラーメッセージ
      setTeamError("班員データバックアップの開始中にネットワークエラーが発生しました。"); 
      alert("班員データバックアップの開始に失敗しました。");
    }
  }, [monitorTeamTaskStatus, setTeamError]); // 依存配列にmonitorTeamTaskStatusを追加


  // ... レンダリングロジック ...

  // ★変更点: ローディング表示の条件に両方のバックアップ状態を追加
  const isAnyBackupRunning = isBackupRunning || isTeamBackupRunning;

  if (loading) {
    return <div>Loading...</div>;
  }

  // ★変更点: エラー表示の条件を調整（バックアップ実行中は表示を抑制）
  if ((error || teamError) && !isAnyBackupRunning) {
    return <div>Error: {error || teamError}</div>;
  }

  return (
    <>
      {/* ★変更点: いずれかが実行中の場合のみLoadingコンポーネントを表示 */}
      <Loading isLoading={isAnyBackupRunning} /> 
      <div className={styles["admin-loading-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {/* ★変更点: 人員バックアップエラーと班員バックアップエラーを両方表示できるように */}
        {(error || teamError) && !isAnyBackupRunning && ( 
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{error || teamError}</div>
        )}
        
        <div className={styles["search-bar"]}>
          <label htmlFor="start-asynchronous1">人員データバックアップ：</label>
          <input
            id="start-asynchronous1"
            name="start-asynchronous1"
            type="button"
            // ★変更点: 他のバックアップが実行中の場合もボタンを無効化
            value={isBackupRunning ? "実行中..." : "開始"} 
            onClick={!isAnyBackupRunning ? startBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <label htmlFor="start-asynchronous2">班員データバックアップ：</label>
          <input
            id="start-asynchronous2"
            name="start-asynchronous2"
            type="button"
            // ★変更点: 班員バックアップの状態を表示し、他のバックアップが実行中の場合もボタンを無効化
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