import React, { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";

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

// --- カスタムHooksとヘルパー関数 ---

/**
 * Cookieから指定された名前の値を抽出するヘルパー関数
 * @param name 取得したいCookieの名前（通常は 'csrftoken'）
 * @returns Cookieの値、またはnull
 */
const getCookie = (name: string): string | null => {
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        const cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        return cookieValue;
      }
    }
  }
  return null;
};


// 💡 修正後の useCsrfToken: Cookieからトークンを取得するように変更
const useCsrfToken = (): string | null => {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    // Cookieから 'csrftoken' を取得する
    // サーバーサイド（Djangoなど）が'csrftoken'という名前のCookieを設定していることを前提とします。
    const token = getCookie('csrftoken'); 
    
    if (!token) {
      // DOMからの取得ロジックは削除し、エラーの原因となるDOMアクセスを回避
      console.error("CSRFトークンが見つかりません。");
    }
    setCsrfToken(token);
  }, []);

  return csrfToken;
};

// タスクの進行状態を監視するカスタムHook
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
      // AxiosでCookieを送信するために withCredentials: true を設定
      axios.get<TaskResponse>(taskEndpoint, { withCredentials: true }) 
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
  const csrfToken = useCsrfToken();

  // startBackup 関数のロジックを React Hooks の形式で実装
  const startBackup = useCallback(async (
    endpoint: string,
    monitorFunc: (taskId: string) => void,
    options: AsyncOperationOptions = {}
  ): Promise<void> => {
    if (!csrfToken) {
      // useCsrfTokenがnullを返した場合に警告
      alert("CSRFトークンが取得できません。処理を中断します。");
      return;
    }
    
    // API BASE URLを付与
    const fullEndpoint = `${process.env.REACT_APP_API_BASE_URL}${endpoint}`;
    
    let headers: Record<string, string> = {
      'X-CSRFToken': csrfToken, // Cookieから取得したトークンを設定
    };
    let body: string | null = null;
    let method: 'POST' | 'GET' = 'POST';

    // 日付の入力が必要なロジックは省略

    try {
      const response = await fetch(fullEndpoint, {
        method: method,
        headers: headers,
        body: body,
        credentials: 'include', // Cookieを送信するために必須
      });

      // HTTPステータスが200番台でなければエラーとして処理
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status} ${response.statusText}`);
      }

      const data: TaskResponse = await response.json();

      if (data.status === 'success' && data.task_id) {
        monitorFunc(data.task_id);
      } else {
        alert(data.message || 'タスクの開始に失敗しました。');
      }
    } catch (err) {
      console.error('Error starting backup:', err);
      const errorMessage = err instanceof Error ? err.message : 'バックアップ開始中にネットワークエラーが発生しました。';
      alert(errorMessage);
    }
  }, [csrfToken]); // csrfTokenが依存配列に含まれていることを確認

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
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_menu/`, {
        withCredentials: true,
      })
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

  // 人員データバックアップ処理 (start-asynchronous5の処理を実装)
  const handleMemberBackup = () => {
    if (isBackupRunning) {
      alert("現在、他のバックアップ処理が実行中です。");
      return;
    }
    
    setError(null);
    setIsBackupRunning(true);
    
    startBackup('/api/start_member_backup', (taskId) => { // APIパスを修正
      // タスク監視開始
      startMonitoring(`${process.env.REACT_APP_API_BASE_URL}/api/check_member_backup_status?task_id=${taskId}`);
    })
    .catch((err) => {
      console.error(err);
      setIsBackupRunning(false);
      // startBackup内でエラー処理を行っているため、通常はここのcatchは実行されない
      setError('バックアップ開始に予期せぬエラーが発生しました。');
    });
  };

  if (loading) {
    // 認証チェック中のローディング表示
    return <div>Loading...</div>;
  }

  // 認証チェックは成功したが、APIからのデータ取得エラーがある場合
  if (error && !isBackupRunning) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      {/* バックアップ実行中のローディング表示 */}
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
          {/* type="submit"をtype="button"に変更し、onChangeをonClickに変更 */}
          <input
            id="start-asynchronous5"
            name="start-asynchronous5"
            type="button" 
            value={isBackupRunning ? "実行中..." : "開始"}
            onClick={handleMemberBackup} // イベントハンドラを接続
            disabled={isBackupRunning}
          />
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;


//import React, { useState, useEffect } from "react";
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
//