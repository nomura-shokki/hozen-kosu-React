import React, { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";



// 今日の日付取得
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// クッキーからCSRFトークン取得
function getCsrfToken() {
  // document.cookieから 'csrftoken=値' の形式を正規表現で探し、値を返す
  return document.cookie.match(/csrftoken=([^;]*)/)?.[1] || '';
}

// メンバー情報の型定義
interface Member {
  employee_no: number;
  name: string;
}

// -------------------------------------------------------------------------
// 汎用タスク進行状態監視カスタムフック
// -------------------------------------------------------------------------
const useTaskMonitor = (
  setIsRunning: (running: boolean) => void,
  setError: (error: string | null) => void,
  taskType: 'backup' | 'delete' | 'load' | 'generic'
) => {

  // アラートメッセージに使用する処理名を決定
  const processName = taskType === 'backup' ? 'データバックアップ' : taskType === 'delete' ? 'データ削除' : 'データロード';

  // タスク成功時の処理
  const handleSuccess = useCallback((data: any) => {
    // 実行中ステートをfalseに設定してローディング表示を終了
    setIsRunning(false);

    // 削除/ロードタスクの場合は完了アラートのみ表示して終了
    if (taskType === 'delete' || taskType === 'load') {
      alert(`${processName}が完了しました。`);
      return;
    }

    // バックアップタスク
    if (data.file_path) {
      // APIのダウンロードエンドポイントを設定
      const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/download_backup`;
      const filePath = data.file_path;
      const link = document.createElement('a');
      link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`;
      link.download = ''; 
      link.click();
      alert(`${processName}が完了し、ダウンロードが開始されました。`);
    } else {
      alert("処理が完了しました。");
    }
  }, [setIsRunning, taskType, processName]);

  // タスクエラー時の処理
  const handleError = useCallback((data: any) => {
    // 実行中ステートをfalseに設定してローディング表示を終了
    setIsRunning(false);
    const defaultMessage = `${processName}処理中にエラーが発生しました。`;
    // エラーメッセージがあればそれを使用、なければデフォルトメッセージ
    const errorMessage = data.message || defaultMessage;
    // エラーステートを更新
    setError(errorMessage);
    alert(errorMessage);
  }, [setIsRunning, setError, processName]);

  //タスクの状態を定期的にチェックするポーリング処理を開始
  const monitorTaskStatus = useCallback((taskId: string) => {
    // タスクステータスチェックのエンドポイント
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/check_backup_status?task_id=${taskId}`;
    
    // 1秒間隔でタスクの状態をチェックするポーリング処理
    const interval = setInterval(() => {
      fetch(endpoint)
        .then(response => response.json())
        .then(data => {
          // 成功の場合
          if (data.status === 'success') {
            clearInterval(interval); // ポーリングを停止
            handleSuccess(data); // 成功時の処理を実行
          // エラーの場合
          } else if (data.status === 'error') {
            clearInterval(interval); // ポーリングを停止
            handleError(data); // エラー時の処理を実行
          }
        })
        .catch(err => {
          // ネットワークエラーが発生した場合
          clearInterval(interval); // ポーリングを停止
          console.error('Network Error:', err);
          handleError({ message: "ネットワークエラーが発生しました。" });
        });
    }, 1000); // 1000ミリ秒 (1秒) ごとにチェック

    // クリーンアップ関数（コンポーネントがアンマウントされたり、依存関係が変わった時にポーリングを停止）
    return () => clearInterval(interval);
  }, [handleSuccess, handleError]);

  return monitorTaskStatus;
};

// -------------------------------------------------------------------------
// AdministratorLoading コンポーネント
// -------------------------------------------------------------------------
const AdministratorLoading: React.FC = () => {
  // コンポーネント全体の初期ローディング状態（認証チェック用）
  const [loading, setLoading] = useState<boolean>(true);
  
  // 実行中のタスク状態を一元管理するオブジェクト
  const initialTaskStates = {
    KosuBackup: false, 
    KosuDelet: false,
    KosuLoad: false, 
    DefBackup: false,
    DefLoad: false,
    MemberBackup: false,
    TeamBackup: false,
    SettingBackup: false,
    AsyncTaskBackup: false, 
    AsyncTaskDelet: false,
    OperationHistoryBackup: false, 
    OperationHistoryDelet: false,
  };
  // 各タスクの実行中ステート
  const [runningStates, setRunningStates] = useState(initialTaskStates);

  // 各タスクのエラー状態を一元管理するオブジェクト
  const initialErrorStates = {
    KosuError: null, DefError: null, MemberError: null, TeamError: null,
    SettingError: null, AsyncTaskError: null, OperationHistoryError: null,
  };
  // 各タスクのエラーステート
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>(initialErrorStates);

  // 日付範囲選択用のステート
  const today = getTodayDateString();
  const [startDay, setStartDay] = useState<string>(today); // 開始日
  const [endDay, setEndDay] = useState<string>(today); // 終了日
  const navigate = useNavigate();
  const [kosuFile, setKosuFile] = useState<File | null>(null);
  const [defFile, setDefFile] = useState<File | null>(null);

  // マウント時処理
  useEffect(() => {
    axios
      // 認証情報をチェックするAPIエンドポイントを叩く
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
          setErrorStates(prev => ({ ...prev, MemberError: err.message }));
        }
        setLoading(false);
      });
  }, [navigate]);

  // Stateセッターの汎用化ヘルパー関数
  // 特定のキーに対応する runningStates を更新する関数を生成
  const createSetter = (key: keyof typeof initialTaskStates) => (value: boolean) => {
    setRunningStates(prev => ({ ...prev, [key]: value }));
  };
  // 特定のキーに対応する errorStates を更新する関数を生成
  const createErrorSetter = (key: keyof typeof initialErrorStates) => (value: string | null) => {
    setErrorStates(prev => ({ ...prev, [key]: value }));
  };

  // タスク監視フックのインスタンス化
  // 各タスク/処理タイプ (backup/delete/load) に対応する専用の監視関数を作成し、マップに格納
  const monitorHooks = {
    KosuBackup: useTaskMonitor(createSetter('KosuBackup'), createErrorSetter('KosuError'), 'backup'),
    KosuDelet: useTaskMonitor(createSetter('KosuDelet'), createErrorSetter('KosuError'), 'delete'),
    KosuLoad: useTaskMonitor(createSetter('KosuLoad'), createErrorSetter('KosuError'), 'load'), 
    DefBackup: useTaskMonitor(createSetter('DefBackup'), createErrorSetter('DefError'), 'backup'),
    DefLoad: useTaskMonitor(createSetter('DefLoad'), createErrorSetter('DefError'), 'load'), // ★追加
    MemberBackup: useTaskMonitor(createSetter('MemberBackup'), createErrorSetter('MemberError'), 'backup'),
    TeamBackup: useTaskMonitor(createSetter('TeamBackup'), createErrorSetter('TeamError'), 'backup'),
    SettingBackup: useTaskMonitor(createSetter('SettingBackup'), createErrorSetter('SettingError'), 'backup'),
    AsyncTaskBackup: useTaskMonitor(createSetter('AsyncTaskBackup'), createErrorSetter('AsyncTaskError'), 'backup'),
    AsyncTaskDelet: useTaskMonitor(createSetter('AsyncTaskDelet'), createErrorSetter('AsyncTaskError'), 'delete'),
    OperationHistoryBackup: useTaskMonitor(createSetter('OperationHistoryBackup'), createErrorSetter('OperationHistoryError'), 'backup'),
    OperationHistoryDelet: useTaskMonitor(createSetter('OperationHistoryDelet'), createErrorSetter('OperationHistoryError'), 'delete'),
  };
  
  // 汎用タスク開始処理関数
  const startTask = useCallback(async (
    taskKey: keyof typeof monitorHooks,  // 監視フックとステートキーを特定するためのキー
    endpointPath: string,  // APIエンドポイントのパス (例: 'kosu_backup')
    processName: string,  // 表示用プロセス名 (例: '工数データバックアップ')
    isDateRanged: boolean = false // 日付範囲が必要かどうか
  ) => {
    // 対応する実行中/エラーセッターを取得
    const isRunningSetter = createSetter(taskKey as keyof typeof initialTaskStates);
    const errorKey = `${taskKey.slice(0, -6)}Error` as keyof typeof initialErrorStates;
    const setError = createErrorSetter(errorKey);

    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/${endpointPath}/`;
    // CSRFトークンをヘッダーに設定
    const headers: Record<string, string> = {
      'X-CSRFToken': getCsrfToken()
    };

    // 実行中ステートを true に設定
    isRunningSetter(true);

    try {
      // 日付範囲が必要な場合はリクエストボディを作成
      const bodyData = isDateRanged ? { start_day: startDay, end_day: endDay } : {};

      // POSTリクエストボディがある場合はContent-Typeを設定
      if (isDateRanged) {
        headers['Content-Type'] = 'application/json';
      }

      // APIへのPOSTリクエストを実行
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        // 日付範囲が必要な場合のみJSONボディを送信
        body: isDateRanged ? JSON.stringify(bodyData) : undefined,
      });
      // レスポンスをJSONとしてパース
      const data = await response.json();

      // APIレスポンスからタスクIDを取得できた場合
      if (data.taskId || (data.status === 'success' && data.task_id)) {
        const taskId = data.taskId || data.task_id;
        // 対応する監視フックを呼び出し、ポーリングを開始
        monitorHooks[taskKey](taskId);
      } else {
        // タスクIDが返されなかった場合（タスク開始失敗）
        isRunningSetter(false);
        const message = data.message || `${processName}の開始に失敗しました。`;
        setError(message);
        alert(message);
      }
    } catch (err) {
      // ネットワークエラーまたはFetch処理自体のエラー
      isRunningSetter(false);
      console.error('Error:', err);
      setError(`${processName}の開始中にネットワークエラーが発生しました。`);
      alert(`${processName}の開始に失敗しました。`);
    }
  }, [monitorHooks, startDay, endDay]);

  // 汎用ファイルロード開始処理関数
  const startFileLoad = useCallback(async (
    taskKey: 'KosuLoad' | 'DefLoad',  // 監視フックとステートキーを特定するためのキー
    endpointPath: string,  // APIエンドポイントのパス (例: 'kosu_load')
    processName: string,  // 表示用プロセス名 (例: '工数データロード')
    fileToLoad: File | null // ロード対象のファイルステート
  ) => {
    // 対応する実行中/エラーセッターを取得
    const isRunningSetter = createSetter(taskKey as keyof typeof initialTaskStates);
    // 例: KosuLoad -> KosuError, DefLoad -> DefError
    const errorKey = `${taskKey.slice(0, -4)}Error` as keyof typeof initialErrorStates;
    const setError = createErrorSetter(errorKey);

    if (!fileToLoad) {
      alert('アップロードするファイルを選択してください。');
      return;
    }
    
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/${endpointPath}/`;
    
    const formData = new FormData();
    formData.append('file', fileToLoad);
    
    // 実行中ステートを true に設定
    isRunningSetter(true);

    try {
      // Fetch APIを使用してファイルをPOST
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken()
        },
        body: formData,
      });
      
      // レスポンスをJSONとしてパース
      const data = await response.json();
      
      // APIレスポンスからタスクIDを取得できた場合
      if (data.taskId || (data.status === 'success' && data.task_id)) {
        const taskId = data.taskId || data.task_id;
        // 対応する監視フックを呼び出し、ポーリングを開始
        monitorHooks[taskKey](taskId);
      } else {
        // タスクIDが返されなかった場合（タスク開始失敗）
        isRunningSetter(false);
        const message = data.message || `${processName}の開始に失敗しました。`;
        setError(message);
        alert(message);
      }
    } catch (err) {
      // ネットワークエラーまたはFetch処理自体のエラー
      isRunningSetter(false);
      console.error('Error:', err);
      setError(`${processName}の開始中にネットワークエラーが発生しました。`);
      alert(`${processName}の開始に失敗しました。`);
    }
  }, [monitorHooks]);

  // Kosuデータロード開始処理関数
  const startKosuload = useCallback(() => {
    return startFileLoad('KosuLoad', 'kosu_load', '工数データロード', kosuFile);
  }, [kosuFile, startFileLoad]);

  // Defデータロード開始処理関数
  const startDefload = useCallback(() => {
    return startFileLoad('DefLoad', 'def_load', '工数区分定義データロード', defFile);
  }, [defFile, startFileLoad]);


  // 各ボタンの onClick ハンドラを startTask に置き換え (具体的なタスク開始関数)
  // 各関数は startTask にタスク固有の引数を渡すだけ
  const startKosuBackup = () => startTask('KosuBackup', 'kosu_backup', '工数データバックアップ', true);
  const startKosuDelet = () => startTask('KosuDelet', 'kosu_delet', '工数データ削除', true);
  const startDefBackup = () => startTask('DefBackup', 'def_backup', '工数区分定義データバックアップ');
  const startMemberBackup = () => startTask('MemberBackup', 'member_backup', '人員データバックアップ');
  const startTeamBackup = () => startTask('TeamBackup', 'team_backup', '班員データバックアップ');
  const startSettingBackup = () => startTask('SettingBackup', 'setting_backup', '設定データバックアップ');
  const startAsyncTaskBackup = () => startTask('AsyncTaskBackup', 'AsyncTask_backup', 'タスク履歴データバックアップ', true);
  const startAsyncTaskDelet = () => startTask('AsyncTaskDelet', 'AsyncTask_delet', 'タスク履歴データ削除', true);
  const startOperationHistoryBackup = () => startTask('OperationHistoryBackup', 'Operation_history_backup', '操作履歴データバックアップ', true);
  const startOperationHistoryDelet = () => startTask('OperationHistoryDelet', 'Operation_history_delet', '操作履歴データ削除', true);

  // 実行中ステートの集約: 1つでも true なら全体として実行中
  const isAnyBackupRunning = Object.values(runningStates).some(state => state);

  // エラー表示用の集約: 1つでも null でないエラーがあれば表示
  const anyError = Object.values(errorStates).find(error => error !== null);

  // 初期認証チェック中のローディング表示
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Loading isLoading={isAnyBackupRunning} /> 
      <div className={styles["admin-loading-wrapper"]}>
        <h1 className={styles["h1-collar"]}>データ管理</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {anyError && !isAnyBackupRunning && ( 
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{anyError}</div>
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

          <label htmlFor="start-kosu-backup">工数データ：</label>
          <input
            id="start-kosu-backup"
            name="start-kosu-backup"
            type="button"
            // 実行中ステートに応じて表示テキストを変更
            value={runningStates.KosuBackup ? "実行中..." : "バックアップ開始"} 
            // 他のタスクが実行中でない場合のみクリック可能
            onClick={!isAnyBackupRunning ? startKosuBackup : undefined} 
            // 他のタスクが実行中の場合はボタンを無効化
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-kosu-delet"
            name="start-kosu-delet"
            type="button"
            value={runningStates.KosuDelet ? "実行中..." : "削除開始"} 
            onClick={!isAnyBackupRunning ? startKosuDelet : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="kosu-file-upload"
            name="kosu-file-upload"
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => setKosuFile(e.target.files ? e.target.files[0] : null)}
            disabled={isAnyBackupRunning}
          />
          <input
            id="start-kosu-load"
            name="start-kosu-load"
            type="button"
            value={runningStates.KosuLoad ? "実行中..." : "ロード開始"} 
            onClick={!isAnyBackupRunning ? startKosuload : undefined} 
            disabled={isAnyBackupRunning || !kosuFile}
          />

          <label htmlFor="start-def-backup">工数区分定義データ：</label>
          <input
            id="start-def-backup"
            name="start-def-backup"
            type="button"
            value={runningStates.DefBackup ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startDefBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="def-file-upload"
            name="def-file-upload"
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => setDefFile(e.target.files ? e.target.files[0] : null)}
            disabled={isAnyBackupRunning}
          />
          <input
            id="start-def-load"
            name="start-def-load"
            type="button"
            value={runningStates.DefLoad ? "実行中..." : "ロード開始"} 
            onClick={!isAnyBackupRunning ? startDefload : undefined} 
            disabled={isAnyBackupRunning || !defFile}
          />

          <label htmlFor="start-member-backup">人員データ：</label>
          <input
            id="start-member-backup"
            name="start-member-backup"
            type="button"
            value={runningStates.MemberBackup ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startMemberBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />

          <label htmlFor="start-team-backup">班員データ：</label>
          <input
            id="start-team-backup"
            name="start-team-backup"
            type="button"
            value={runningStates.TeamBackup ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startTeamBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />

          <label htmlFor="start-setting-backup">設定データ：</label>
          <input
            id="start-setting-backup"
            name="start-setting-backup"
            type="button"
            value={runningStates.SettingBackup ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startSettingBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />

          <label htmlFor="start-async-backup">タスク履歴データ：</label>
          <input
            id="start-async-backup"
            name="start-async-backup"
            type="button"
            value={runningStates.AsyncTaskBackup ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startAsyncTaskBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-async-delet"
            name="start-async-delet"
            type="button"
            value={runningStates.AsyncTaskDelet ? "実行中..." : "削除開始"} 
            onClick={!isAnyBackupRunning ? startAsyncTaskDelet : undefined} 
            disabled={isAnyBackupRunning} 
          />

          <label htmlFor="start-operation-backup">操作履歴データ：</label>
          <input
            id="start-operation-backup"
            name="start-operation-backup"
            type="button"
            value={runningStates.OperationHistoryBackup ? "実行中..." : "バックアップ開始"} 
            onClick={!isAnyBackupRunning ? startOperationHistoryBackup : undefined} 
            disabled={isAnyBackupRunning} 
          />
          <input
            id="start-operation-delet"
            name="start-operation-delet"
            type="button"
            value={runningStates.OperationHistoryDelet ? "実行中..." : "削除開始"} 
            onClick={!isAnyBackupRunning ? startOperationHistoryDelet : undefined} 
            disabled={isAnyBackupRunning} 
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;