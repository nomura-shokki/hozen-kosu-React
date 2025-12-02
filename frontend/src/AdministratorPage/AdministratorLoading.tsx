import React, { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";

// --- Axios CSRF/Cookie設定 (変更なし) ---
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true; // すべてのAxiosリクエストでCookieを送信

// --- ユーティリティ型定義 ---

interface TaskResponse {
  status: 'success' | 'error' | 'pending';
  task_id?: string;
  message?: string;
  file_path?: string;
}

interface AsyncOperationOptions {
  requireDates?: boolean;
}

const getCookie = (name: string): string | null => {
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        const cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        return cookieValue;
      }
    }
  }
  return null;
};

const useTaskMonitor = (
  initialEndpoint: string | null,
  onSuccess: (data: TaskResponse) => void,
  onError: (data: TaskResponse) => void = (data) => alert(data.message)
) => {
  const [taskEndpoint, setTaskEndpoint] = useState<string | null>(initialEndpoint);

  useEffect(() => {
    if (!taskEndpoint) return;

    // ポーリング処理を開始
    const interval = setInterval(() => {
      // Axiosのグローバル設定 (withCredentials: true) を使用
      axios.get<TaskResponse>(taskEndpoint) 
        .then(response => {
          const data = response.data;
          if (data.status === 'success') {
            clearInterval(interval);
            onSuccess(data);
          } else if (data.status === 'error') {
            clearInterval(interval);
            onError(data);
          }
          // 'pending' の場合は監視続行
        })
        .catch(err => {
          clearInterval(interval);
          console.error('Task monitoring error:', err);
          onError({ status: 'error', message: 'ネットワークエラーが発生しました。' });
        });
    }, 1000); // 1秒間隔

    // クリーンアップ関数
    return () => clearInterval(interval);
  }, [taskEndpoint, onSuccess, onError]);

  // タスク監視を開始するための関数
  const startMonitoring = useCallback((endpoint: string) => {
    setTaskEndpoint(endpoint);
  }, []);

  return { startMonitoring };
};

// ファイルダウンロードヘルパー関数
const downloadFile = (endpoint: string, filePath?: string) => {
  if (!filePath) {
    alert("ダウンロードするファイルパスがありません。");
    return;
  }
  const link = document.createElement('a');
  // API BASE URLを付与
  link.href = `${process.env.REACT_APP_API_BASE_URL}${endpoint}?file_path=${encodeURIComponent(filePath)}`;
  link.download = ''; // ファイル名はサーバー設定に委ねる
  document.body.appendChild(link); // Firefoxなどで必要
  link.click();
  document.body.removeChild(link);
};

// バックアップ開始処理のカスタムHook (startBackup関数を模倣)
const useAsyncOperation = () => {
  const startBackup = useCallback(async (
    endpoint: string,
    monitorFunc: (taskId: string) => void,
    options: AsyncOperationOptions = {}
  ): Promise<void> => {

    // 💡 修正点 1: CSRFトークンをクッキーから手動で取得
    const csrfToken = getCookie('csrftoken'); 
    if (!csrfToken) {
        alert('CSRFトークンが取得できませんでした。ページをリロードしてください。');
        // Promise.reject() を使用してエラーをスローする
        throw new Error('CSRF Token not found'); 
    }

    const fullEndpoint = `${process.env.REACT_APP_API_BASE_URL}${endpoint}`;
    
    // fetch から axios に変更
    try {
      const response = await axios.post<TaskResponse>( // POSTメソッドを使用
        fullEndpoint, 
        {}, // bodyは空オブジェクト（または必要なデータ）
        {
          headers: {
            'Content-Type': 'application/json', // 通常のPOSTリクエストとして
            // 💡 修正点 2: 取得したCSRFトークンをヘッダーに明示的に設定
            'X-CSRFToken': csrfToken, 
          }
        }
      );

      const data = response.data;

      if (data.status === 'success' && data.task_id) {
        monitorFunc(data.task_id);
      } else {
        alert(data.message || 'タスクの開始に失敗しました。');
      }
    } catch (err) {
      console.error('Error starting backup:', err);
            // AxiosErrorの型ガード
      const errorMessage = (err as AxiosError).response?.status === 403 
        ? 'CSRFエラーにより処理が拒否されました (403 Forbidden)。サーバーがCSRFクッキーを正しく設定しているか確認してください。' 
        : err instanceof Error ? err.message : 'バックアップ開始中にネットワークエラーが発生しました。';
      alert(errorMessage);
        // エラーを再スローして呼び出し元 (.catch) に伝える
        throw err; 
    }
  }, []); 

  return { startBackup };
};
// --- コンポーネント定義 ---

interface Member {
  employee_no: number;
  name: string;
}

const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isBackupRunning, setIsBackupRunning] = useState<boolean>(false);
  const navigate = useNavigate();
  const { startBackup } = useAsyncOperation();

  // タスク監視が成功した際のコールバック
  const handleMonitorSuccess = useCallback((data: TaskResponse) => {
    setIsBackupRunning(false);
    // APIパスを修正
    downloadFile('/api/download_member_backup', data.file_path); 
    alert('人員データバックアップが完了しました！');
  }, []);
  
  // タスク監視が失敗した際のコールバック
  const handleMonitorError = useCallback((data: TaskResponse) => {
    setIsBackupRunning(false);
    setError(data.message || 'バックアップ処理中にエラーが発生しました。');
  }, []);

  const { startMonitoring } = useTaskMonitor(null, handleMonitorSuccess, handleMonitorError);

  // 画面ロード時の認証チェック
  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_menu/`)
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

  const handleMemberBackup = () => {
    if (isBackupRunning) {
      alert("現在、他のバックアップ処理が実行中です。");
      return;
    }
    
    setError(null);
    setIsBackupRunning(true);
    startBackup('/api/start_member_backup', (taskId) => {
      startMonitoring(`${process.env.REACT_APP_API_BASE_URL}/api/check_member_backup_status?task_id=${taskId}`);
    })
    .catch((err) => {
      // startBackup内で throw されたエラーをここで捕捉し、isRunningを解除
      console.error(err);
      setIsBackupRunning(false);
      // CSRFトークンが見つからない場合のエラーは startBackup 内ですでに alert されているため、ここでは一般的なメッセージを表示
      if (!(err instanceof Error && err.message === 'CSRF Token not found')) {
        setError('バックアップ開始に予期せぬエラーが発生しました。');
      }
    });
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
            onClick={handleMemberBackup}
            disabled={isBackupRunning}
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;
















/*
import React, { useState, useEffect } from "react";
import axios from "axios";
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
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_menu/`, {
        withCredentials: true,
      })
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-loading-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {error && (
          <div role="alert">{error}</div>
        )}

        <div className={styles["search-bar"]}>
          <label htmlFor="menu_row">人員データバックアップ：</label>
          <input
            id="start-asynchronous5"
            name="start-asynchronous5"
            type="submit"
            onChange={handleChange}
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;
*/