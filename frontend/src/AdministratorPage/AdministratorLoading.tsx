import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios";
import axios, { AxiosError } from "axios";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";



const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function getCsrfToken() {
  return document.cookie.match(/csrftoken=([^;]*)/)?.[1] || '';
}

interface Member {
  employee_no: number;
  name: string;
}

const useTaskMonitor = (
  setIsRunning: (running: boolean) => void,
  setError: (error: string | null) => void,
  taskType: 'backup' | 'delete' | 'load' | 'generic'
) => {

  const processName = taskType === 'backup' ? 'データバックアップ' : taskType === 'delete' ? 'データ削除' : 'データロード';

  const handleSuccess = useCallback((data: any) => {
    setIsRunning(false);

    if (taskType === 'delete' || taskType === 'load') {
      alert(`${processName}が完了しました。`);
      return;
    }

    if (data.file_path) {
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

  const handleError = useCallback((data: any) => {
    setIsRunning(false);
    const defaultMessage = `${processName}処理中にエラーが発生しました。`;
    const errorMessage = data.message || defaultMessage;
    setError(errorMessage);
    alert(errorMessage);
  }, [setIsRunning, setError, processName]);

  const monitorTaskStatus = useCallback((taskId: string) => {
    const endpoint = `/api/check_backup_status?task_id=${taskId}`;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(endpoint);
        const data = response.data;
        if (data.status === 'success') {
          clearInterval(interval);
          handleSuccess(data);
        } else if (data.status === 'error') {
          clearInterval(interval);
          handleError(data);
        }
      } catch (err) {
        clearInterval(interval);
        console.error('Network Error:', err);
        handleError({ message: "ネットワークエラーが発生しました。" });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [handleSuccess, handleError]);

  return monitorTaskStatus;
};

const AdministratorLoading: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);

  const initialTaskStates = useMemo(() => ({
    KosuBackup: false,
    KosuDelet: false,
    KosuLoad: false,
    DefBackup: false,
    DefLoad: false,
    ChoiceBackup: false,
    ChoiceLoad: false,
    MemberBackup: false,
    MemberLoad: false,
    TeamBackup: false,
    TeamLoad: false,
    InquiryBackup: false,
    InquiryLoad: false,
    SettingBackup: false,
    SettingLoad: false,
    AsyncTaskBackup: false,
    AsyncTaskDelet: false,
    HistoryBackup: false,
    HistoryDelet: false,
  }), []); 

  const [runningStates, setRunningStates] = useState(initialTaskStates);

  const initialErrorStates = useMemo(() => ({
    KosuError: null, DefError: null, ChoiceError: null, MemberError: null, TeamError: null, InquiryError: null,
    SettingError: null, AsyncTaskError: null, HistoryError: null,
  }), []); 
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>(initialErrorStates);

  const today = getTodayDateString();
  const [startDay, setStartDay] = useState<string>(today);
  const [endDay, setEndDay] = useState<string>(today);
  const navigate = useNavigate();
  const [kosuFile, setKosuFile] = useState<File | null>(null);
  const [defFile, setDefFile] = useState<File | null>(null);
  const [choiceFile, setChoiceFile] = useState<File | null>(null);
  const [memberFile, setMemberFile] = useState<File | null>(null);
  const [teamFile, setTeamFile] = useState<File | null>(null);
  const [inquiryFile, setInquiryFile] = useState<File | null>(null);
  const [settingFile, setSettingFile] = useState<File | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.get<Member>("/api/manager_Loading/");
      } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status === 401) navigate("/login");
        else if (axiosError.response?.status === 403) navigate("/");
        else setErrorStates(prev => ({ ...prev, MemberError: axiosError.message }));
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const createSetter = useCallback((key: keyof typeof initialTaskStates) => (value: boolean) => {
    setRunningStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const createErrorSetter = useCallback((key: keyof typeof initialErrorStates) => (value: string | null) => {
    setErrorStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const KosuBackupMonitor = useTaskMonitor(createSetter('KosuBackup'), createErrorSetter('KosuError'), 'backup');
  const KosuDeletMonitor = useTaskMonitor(createSetter('KosuDelet'), createErrorSetter('KosuError'), 'delete');
  const KosuLoadMonitor = useTaskMonitor(createSetter('KosuLoad'), createErrorSetter('KosuError'), 'load');
  const DefBackupMonitor = useTaskMonitor(createSetter('DefBackup'), createErrorSetter('DefError'), 'backup');
  const DefLoadMonitor = useTaskMonitor(createSetter('DefLoad'), createErrorSetter('DefError'), 'load');
  const ChoiceBackupMonitor = useTaskMonitor(createSetter('ChoiceBackup'), createErrorSetter('ChoiceError'), 'backup');
  const ChoiceLoadMonitor = useTaskMonitor(createSetter('ChoiceLoad'), createErrorSetter('ChoiceError'), 'load');
  const MemberBackupMonitor = useTaskMonitor(createSetter('MemberBackup'), createErrorSetter('MemberError'), 'backup');
  const MemberLoadMonitor = useTaskMonitor(createSetter('MemberLoad'), createErrorSetter('MemberError'), 'load');
  const TeamBackupMonitor = useTaskMonitor(createSetter('TeamBackup'), createErrorSetter('TeamError'), 'backup');
  const TeamLoadMonitor = useTaskMonitor(createSetter('TeamLoad'), createErrorSetter('TeamError'), 'load');
  const InquiryBackupMonitor = useTaskMonitor(createSetter('InquiryBackup'), createErrorSetter('InquiryError'), 'backup');
  const InquiryLoadMonitor = useTaskMonitor(createSetter('InquiryLoad'), createErrorSetter('InquiryError'), 'load');
  const SettingBackupMonitor = useTaskMonitor(createSetter('SettingBackup'), createErrorSetter('SettingError'), 'backup');
  const SettingLoadMonitor = useTaskMonitor(createSetter('SettingLoad'), createErrorSetter('SettingError'), 'load');
  const AsyncTaskBackupMonitor = useTaskMonitor(createSetter('AsyncTaskBackup'), createErrorSetter('AsyncTaskError'), 'backup');
  const AsyncTaskDeletMonitor = useTaskMonitor(createSetter('AsyncTaskDelet'), createErrorSetter('AsyncTaskError'), 'delete');
  const HistoryBackupMonitor = useTaskMonitor(createSetter('HistoryBackup'), createErrorSetter('HistoryError'), 'backup');
  const HistoryDeletMonitor = useTaskMonitor(createSetter('HistoryDelet'), createErrorSetter('HistoryError'), 'delete');

  const monitorHooks = useMemo(() => ({
    KosuBackup: KosuBackupMonitor,
    KosuDelet: KosuDeletMonitor,
    KosuLoad: KosuLoadMonitor,
    DefBackup: DefBackupMonitor,
    DefLoad: DefLoadMonitor,
    ChoiceBackup: ChoiceBackupMonitor,
    ChoiceLoad: ChoiceLoadMonitor,
    MemberBackup: MemberBackupMonitor,
    MemberLoad: MemberLoadMonitor,
    TeamBackup: TeamBackupMonitor,
    TeamLoad: TeamLoadMonitor,
    InquiryBackup: InquiryBackupMonitor,
    InquiryLoad: InquiryLoadMonitor,
    SettingBackup: SettingBackupMonitor,
    SettingLoad: SettingLoadMonitor,
    AsyncTaskBackup: AsyncTaskBackupMonitor,
    AsyncTaskDelet: AsyncTaskDeletMonitor,
    HistoryBackup: HistoryBackupMonitor,
    HistoryDelet: HistoryDeletMonitor,
  }), [
    KosuBackupMonitor, KosuDeletMonitor, KosuLoadMonitor, DefBackupMonitor, DefLoadMonitor, 
    ChoiceBackupMonitor, ChoiceLoadMonitor, MemberBackupMonitor, MemberLoadMonitor, 
    TeamBackupMonitor, TeamLoadMonitor, InquiryBackupMonitor, InquiryLoadMonitor, 
    SettingBackupMonitor, SettingLoadMonitor, AsyncTaskBackupMonitor, AsyncTaskDeletMonitor, 
    HistoryBackupMonitor, HistoryDeletMonitor,
  ]);

  const startTask = useCallback(async (
    taskKey: keyof typeof monitorHooks,
    endpointPath: string,
    processName: string,
    isDateRanged: boolean = false
  ) => {
    const isRunningSetter = createSetter(taskKey as keyof typeof initialTaskStates);
    const errorKey = taskKey.endsWith('Delet') ?
      `${taskKey.slice(0, -5)}Error` as keyof typeof initialErrorStates :
      `${taskKey.slice(0, -6)}Error` as keyof typeof initialErrorStates;
    const setError = createErrorSetter(errorKey);

    setErrorStates(initialErrorStates);

    const endpoint = `/api/${endpointPath}/`;

    isRunningSetter(true);

    try {
      const bodyData = isDateRanged ? { start_day: startDay, end_day: endDay } : {};

      const response = await api.post(endpoint, isDateRanged ? bodyData : undefined);
      const data = response.data;

      if (data.taskId || (data.status === 'success' && data.task_id)) {
        const taskId = data.taskId || data.task_id;
        monitorHooks[taskKey](taskId);
      } else {
        isRunningSetter(false);
        const message = data.message || `${processName}の開始に失敗しました。`;
        setError(message);
        alert(message);
      }
    } catch (err) {
      isRunningSetter(false);
      console.error('Error:', err);
      setError(`${processName}の開始中にネットワークエラーが発生しました。`);
      alert(`${processName}の開始に失敗しました。`);
    }
  }, [monitorHooks, startDay, endDay, createSetter, createErrorSetter, initialErrorStates]);

  const startFileLoad = useCallback(async (
    taskKey: 'KosuLoad' | 'DefLoad' | 'ChoiceLoad' | 'MemberLoad' | 'TeamLoad' | 'InquiryLoad' | 'SettingLoad',
    endpointPath: string,
    processName: string,
    fileToLoad: File | null
  ) => {
    const isRunningSetter = createSetter(taskKey as keyof typeof initialTaskStates);
    const errorKey = `${taskKey.slice(0, -4)}Error` as keyof typeof initialErrorStates;
    const setError = createErrorSetter(errorKey);

    setErrorStates(initialErrorStates);

    if (!fileToLoad) {
      alert('アップロードするファイルを選択してください。');
      return;
    }

    const endpoint = `/api/${endpointPath}/`;

    const formData = new FormData();
    formData.append('file', fileToLoad);

    isRunningSetter(true);

    try {
      const response = await api.post(endpoint, formData);
      const data = response.data;

      if (data.taskId || (data.status === 'success' && data.task_id)) {
        const taskId = data.taskId || data.task_id;
        monitorHooks[taskKey](taskId);
      } else {
        isRunningSetter(false);
        const message = data.message || `${processName}の開始に失敗しました。`;
        setError(message);
        alert(message);
      }
    } catch (err) {
      isRunningSetter(false);
      console.error('Error:', err);
      setError(`${processName}の開始中にネットワークエラーが発生しました。`);
      alert(`${processName}の開始に失敗しました。`);
    }
  }, [monitorHooks, createSetter, createErrorSetter, initialErrorStates]);

  const startKosuload = useCallback(() => {
    return startFileLoad('KosuLoad', 'kosu_load', '工数データロード', kosuFile);
  }, [kosuFile, startFileLoad]);

  const startDefload = useCallback(() => {
    return startFileLoad('DefLoad', 'def_load', '工数区分定義データロード', defFile);
  }, [defFile, startFileLoad]);

  const startChoiceload = useCallback(() => {
    return startFileLoad('ChoiceLoad', 'choice_load', '作業詳細選択肢データロード', choiceFile);
  }, [choiceFile, startFileLoad]);

  const startMemberload = useCallback(() => {
    return startFileLoad('MemberLoad', 'member_load', '人員データロード', memberFile);
  }, [memberFile, startFileLoad]);

  const startTeamload = useCallback(() => {
    return startFileLoad('TeamLoad', 'team_load', '班員データロード', teamFile);
  }, [teamFile, startFileLoad]);

  const startInquiryload = useCallback(() => {
    return startFileLoad('InquiryLoad', 'inquiry_load', '問い合わせデータロード', inquiryFile);
  }, [inquiryFile, startFileLoad]);

  const startSettingload = useCallback(() => {
    return startFileLoad('SettingLoad', 'setting_load', '設定データロード', settingFile);
  }, [settingFile, startFileLoad]);

  const startKosuBackup = () => startTask('KosuBackup', 'kosu_backup', '工数データバックアップ', true);
  const startKosuDelet = () => startTask('KosuDelet', 'kosu_delet', '工数データ削除', true);
  const startDefBackup = () => startTask('DefBackup', 'def_backup', '工数区分定義データバックアップ');
  const startChoiceBackup = () => startTask('ChoiceBackup', 'choice_backup', '作業詳細選択肢データバックアップ');
  const startMemberBackup = () => startTask('MemberBackup', 'member_backup', '人員データバックアップ');
  const startTeamBackup = () => startTask('TeamBackup', 'team_backup', '班員データバックアップ');
  const startInquiryBackup = () => startTask('InquiryBackup', 'inquiry_backup', '問い合わせデータバックアップ');
  const startSettingBackup = () => startTask('SettingBackup', 'setting_backup', '設定データバックアップ');
  const startAsyncTaskBackup = () => startTask('AsyncTaskBackup', 'AsyncTask_backup', 'タスク履歴データバックアップ', true);
  const startAsyncTaskDelet = () => startTask('AsyncTaskDelet', 'AsyncTask_delet', 'タスク履歴データ削除', true);
  const startHistoryBackup = () => startTask('HistoryBackup', 'History_backup', '操作履歴データバックアップ', true);
  const startHistoryDelet = () => startTask('HistoryDelet', 'History_delet', '操作履歴データ削除', true);

  const isAnyBackupRunning = Object.values(runningStates).some(state => state);

  const anyError = Object.values(errorStates).find(error => error !== null);

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
          <label htmlFor="start_day">期間指定：</label>
          <div className={styles["input-row"]}>
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
          </div>

          <label htmlFor="start-kosu-backup">工数データ(バックアップ&削除は日付指定)：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-kosu-backup"
              name="start-kosu-backup"
              type="button"
              value={runningStates.KosuBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startKosuBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["kosu-button"]}
            />
            <input
              id="start-kosu-delet"
              name="start-kosu-delet"
              type="button"
              value={runningStates.KosuDelet ? "実行中..." : "削除開始"}
              onClick={!isAnyBackupRunning ? startKosuDelet : undefined}
              disabled={isAnyBackupRunning}
              className={styles["kosu-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="kosu-file-upload"
                name="kosu-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setKosuFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="kosu-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {kosuFile ? kosuFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-kosu-load"
                name="start-kosu-load"
                type="button"
                value={runningStates.KosuLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startKosuload : undefined}
                disabled={isAnyBackupRunning || !kosuFile}
                className={styles["kosu-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-def-backup">工数区分定義データ：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-def-backup"
              name="start-def-backup"
              type="button"
              value={runningStates.DefBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startDefBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["def-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="def-file-upload"
                name="def-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setDefFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="def-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {defFile ? defFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-def-load"
                name="start-def-load"
                type="button"
                value={runningStates.DefLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startDefload : undefined}
                disabled={isAnyBackupRunning || !defFile}
                className={styles["def-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-Choice-backup">作業詳細選択肢データ：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-choice-backup"
              name="start-choice-backup"
              type="button"
              value={runningStates.ChoiceBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startChoiceBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["def-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="choice-file-upload"
                name="choice-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setChoiceFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="choice-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {choiceFile ? choiceFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-choice-load"
                name="start-choice-load"
                type="button"
                value={runningStates.DefLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startChoiceload : undefined}
                disabled={isAnyBackupRunning || !choiceFile}
                className={styles["def-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-member-backup">人員データ：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-member-backup"
              name="start-member-backup"
              type="button"
              value={runningStates.MemberBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startMemberBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["member-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="member-file-upload"
                name="member-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setMemberFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="member-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {memberFile ? memberFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-member-load"
                name="start-member-load"
                type="button"
                value={runningStates.MemberLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startMemberload : undefined}
                disabled={isAnyBackupRunning || !memberFile}
                className={styles["member-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-team-backup">班員データ：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-team-backup"
              name="start-team-backup"
              type="button"
              value={runningStates.TeamBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startTeamBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["team-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="team-file-upload"
                name="team-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setTeamFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="team-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {teamFile ? teamFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-team-load"
                name="start-team-load"
                type="button"
                value={runningStates.TeamLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startTeamload : undefined}
                disabled={isAnyBackupRunning || !teamFile}
                className={styles["team-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-inquiry-backup">問い合わせデータ：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-inquiry-backup"
              name="start-inquiry-backup"
              type="button"
              value={runningStates.InquiryBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startInquiryBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["inquiry-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="inquiry-file-upload"
                name="inquiry-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setInquiryFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="inquiry-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {inquiryFile ? inquiryFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-inquiry-load"
                name="start-inquiry-load"
                type="button"
                value={runningStates.InquiryLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startInquiryload : undefined}
                disabled={isAnyBackupRunning || !inquiryFile}
                className={styles["inquiry-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-setting-backup">設定データ：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-setting-backup"
              name="start-setting-backup"
              type="button"
              value={runningStates.SettingBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startSettingBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
            <div className={styles["input-column"]}>
              <input
                id="setting-file-upload"
                name="setting-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setSettingFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              <label
                htmlFor="setting-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {settingFile ? settingFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              <input
                id="start-setting-load"
                name="start-setting-load"
                type="button"
                value={runningStates.SettingLoad ? "実行中..." : "ロード開始"}
                onClick={!isAnyBackupRunning ? startSettingload : undefined}
                disabled={isAnyBackupRunning || !settingFile}
                className={styles["setting-button"]}
              />
            </div>
          </div>

          <label htmlFor="start-async-backup">タスク履歴データ(日付指定)：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-async-backup"
              name="start-async-backup"
              type="button"
              value={runningStates.AsyncTaskBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startAsyncTaskBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
            <input
              id="start-async-delet"
              name="start-async-delet"
              type="button"
              value={runningStates.AsyncTaskDelet ? "実行中..." : "削除開始"}
              onClick={!isAnyBackupRunning ? startAsyncTaskDelet : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
          </div>

          <label htmlFor="start-operation-backup">操作履歴データ(日付指定)：</label>
          <div className={styles["input-row"]}>
            <input
              id="start-operation-backup"
              name="start-operation-backup"
              type="button"
              value={runningStates.HistoryBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startHistoryBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
            <input
              id="start-operation-delet"
              name="start-operation-delet"
              type="button"
              value={runningStates.HistoryDelet ? "実行中..." : "削除開始"}
              onClick={!isAnyBackupRunning ? startHistoryDelet : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AdministratorLoading;