/**
 * ============================================================
 * ファイル名 : AdministratorLoading.tsx
 * 種別       : 画面コンポーネント（データ管理画面）
 * 概要       : 各種データのバックアップ（Excelファイルのダウンロード）・ロード（Excelファイルからの登録）・
 *              期間指定での削除を行う管理者向け画面。
 *              処理はサーバー側で非同期タスク（バックグラウンド処理）として実行され、
 *              画面は1秒ごとに処理状況を問い合わせて完了を待つ。
 *
 * 主な機能   :
 *   - 期間（開始日〜終了日）の指定（工数データ・非同期タスクデータ・操作履歴データのバックアップ/削除に使用）
 *   - 工数 / 工数区分定義 / 作業詳細選択肢 / 人員 / 班員 / 問い合わせ / 設定 データのバックアップとロード
 *   - 工数 / 非同期タスク / 操作履歴 データの期間指定削除
 *   - 処理中は全ボタンを無効化し、ローディング表示を出す（同時に複数の処理を走らせない）
 *   - 処理完了後、バックアップファイルを自動でダウンロード
 *
 * 使用API    : GET  /api/manager_loading/        画面表示時の管理者権限の確認（kosu/views/main_views.py の AdministratorLoading）
 *              POST /api/<種類>_backup/ 等        非同期タスクの開始（kosu/views/asynchronous_views.py の backup）
 *                   kosu_backup / kosu_delet / kosu_load / def_backup / def_load / choice_backup / choice_load /
 *                   member_backup / member_load / team_backup / team_load / inquiry_backup / inquiry_load /
 *                   setting_backup / setting_load / AsyncTask_backup / AsyncTask_delet / History_backup / History_delet
 *              GET  /api/check_backup_status     非同期タスクの処理状況確認（同 check_task_status）
 *              GET  /api/download_backup         バックアップファイルのダウンロード（同 download_file）
 * 画面URL    : /manager-loading                   （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorLoading.module.css, Components/Loading.tsx,
 *              kosu/tasks.py（バックアップ・ロード・削除の処理本体）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import { AxiosError } from "axios"; // エラーの型（権限確認のエラー判定に使用）
import { useNavigate, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中（処理実行中）の表示
import styles from "../styles/AdministratorPage/AdministratorLoading.module.css";



// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 今日の日付を "YYYY-MM-DD" 形式の文字列で返す（期間指定欄の初期値に使う）。
 *
 * 月は 0 始まり（0=1月）のため +1 し、月・日は padStart で2桁に0埋めする（例: 3 → "03"）。
 *
 * @returns 今日の日付（例: "2026-11-09"）
 */
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================
// 型定義
// ============================================================

/** ログイン者の人員データ（権限確認の api.get の型指定に使用。レスポンスの中身は使わない） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
}

// ============================================================
// カスタムフック
// ============================================================

/**
 * 非同期タスクの完了を監視する関数を作るカスタムフック（React のフック機能を組み合わせた自作の部品）。
 *
 * 戻り値の関数にタスクIDを渡すと、1秒ごとに処理状況APIを呼び、
 * 成功なら完了処理（バックアップならファイルのダウンロード）、失敗ならエラー表示を行う。
 *
 * @param setIsRunning - 処理実行中フラグを更新する関数（完了・失敗時に false にする）
 * @param setError     - エラーメッセージを更新する関数
 * @param taskType     - 処理の種類（'backup': バックアップ / 'delete': 削除 / 'load': ロード / 'generic': 汎用）
 * @returns タスクIDを受け取って監視を開始する関数（その関数は監視を止める関数を返す）
 */
const useTaskMonitor = (
  setIsRunning: (running: boolean) => void,
  setError: (error: string | null) => void,
  taskType: 'backup' | 'delete' | 'load' | 'generic'
) => {

  // メッセージに使う処理名（'load' と 'generic' はどちらも「データロード」になる）
  const processName = taskType === 'backup' ? 'データバックアップ' : taskType === 'delete' ? 'データ削除' : 'データロード';

  /**
   * 非同期タスクが成功したときの処理。
   *
   * 削除・ロードは完了メッセージを出すだけ。バックアップはサーバーが作成したファイルを
   * ダウンロードAPI経由で取得させる（見えないリンクを作ってクリックする）。
   * useCallback（関数を使い回すReactの仕組み）で包み、依存する値が変わったときだけ作り直す。
   *
   * @param data - 処理状況APIのレスポンス（{ status: "success", file_path: サーバー上のファイルパス }）
   * @returns なし
   */
  const handleSuccess = useCallback((data: any) => {
    // 実行中フラグを解除する
    setIsRunning(false);

    // 削除・ロードはダウンロードするファイルがないため、完了メッセージだけ出して終了
    if (taskType === 'delete' || taskType === 'load') {
      alert(`${processName}が完了しました。`);
      return;
    }

    // バックアップ: ファイルパスが返ってきた場合はダウンロードを開始する
    if (data.file_path) {
      // GET /api/download_backup?file_path=... : バックアップファイルをダウンロード
      //   画面と同じサーバーへの相対URLにする（Vite のビルドでは process.env が {} に置き換わり、
      //   process.env.REACT_APP_API_BASE_URL は undefined になるため、使わない）
      const endpoint = "/api/download_backup";
      const filePath = data.file_path;
      // 画面には表示しない <a> 要素を作り、クリックしたことにしてダウンロードを始める
      //   encodeURIComponent: ファイルパス中の日本語や記号をURLで使える形に変換する
      const link = document.createElement('a');
      link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`;
      link.download = '';
      link.click();
      alert(`${processName}が完了し、ダウンロードが開始されました。`);
    } else {
      // ファイルパスがない場合は完了メッセージだけ出す
      alert("処理が完了しました。");
    }
  }, [setIsRunning, taskType, processName]);

  /**
   * 非同期タスクが失敗したときの処理（エラーメッセージを保存してダイアログでも知らせる）。
   *
   * @param data - エラー情報（{ message: エラーメッセージ }）。message がなければ既定の文言を使う
   * @returns なし
   */
  const handleError = useCallback((data: any) => {
    // 実行中フラグを解除する
    setIsRunning(false);
    // サーバーからのメッセージがなければ「〇〇処理中にエラーが発生しました。」を使う
    const defaultMessage = `${processName}処理中にエラーが発生しました。`;
    const errorMessage = data.message || defaultMessage;
    setError(errorMessage);
    alert(errorMessage);
  }, [setIsRunning, setError, processName]);

  /**
   * 指定したタスクIDの処理状況を1秒ごとに確認し、完了するまで監視する。
   *
   * 状況APIの status が "success" なら handleSuccess、"error" なら handleError を呼んで監視を止める。
   * "pending"（処理中）の間は何もせず次の確認を待つ。
   *
   * @param taskId - 監視する非同期タスクのID（タスク開始APIが返した task_id）
   * @returns 監視（setInterval）を止める関数
   */
  const monitorTaskStatus = useCallback((taskId: string) => {
    // GET /api/check_backup_status?task_id=... : 非同期タスクの処理状況を確認
    const endpoint = `/api/check_backup_status?task_id=${taskId}`;

    // setInterval: 指定した間隔（1000ミリ秒＝1秒）ごとに処理を繰り返し実行する
    const interval = setInterval(async () => {
      try {
        const response = await api.get(endpoint);
        const data = response.data;
        // 成功: 監視を止めて完了処理へ
        if (data.status === 'success') {
          clearInterval(interval);
          handleSuccess(data);
        // 失敗: 監視を止めてエラー処理へ
        } else if (data.status === 'error') {
          clearInterval(interval);
          handleError(data);
        }
        // それ以外（"pending"）: 処理中のため次の確認を待つ
      } catch (err) {
        // 通信エラー（またはサーバーが 4xx/5xx を返した場合）: 監視を止めてエラー扱いにする
        clearInterval(interval);
        console.error('Network Error:', err);
        handleError({ message: "ネットワークエラーが発生しました。" });
      }
    }, 1000);

    // 呼び出し側が監視を途中で止められるよう、止める関数を返す
    return () => clearInterval(interval);
  }, [handleSuccess, handleError]);

  return monitorTaskStatus;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * データ管理画面。
 *
 * 各データ種類ごとに「バックアップ開始」「ロード開始」「削除開始」ボタンを並べる。
 * ボタンを押すとサーバーで非同期タスクが開始され、useTaskMonitor で完了を監視する。
 * どれか1つでも実行中の間は、全ボタンを無効にしてローディング表示を出す。
 *
 * @returns データ管理画面のJSX
 */
const AdministratorLoading: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [loading, setLoading] = useState<boolean>(true); // 権限確認中かどうか（true の間は "Loading..." 表示）

  // 処理ごとの実行中フラグの初期値（すべて false＝実行していない）。
  // キー名は「データ種類 + 処理（Backup / Load / Delet）」。
  // useMemo（計算結果を使い回すReactの仕組み）で、描画のたびに新しいオブジェクトを作らないようにする
  const initialTaskStates = useMemo(() => ({
    KosuBackup: false, // 工数データのバックアップ
    KosuDelet: false, // 工数データの削除
    KosuLoad: false, // 工数データのロード
    DefBackup: false, // 工数区分定義データのバックアップ
    DefLoad: false, // 工数区分定義データのロード
    ChoiceBackup: false, // 作業詳細選択肢データのバックアップ
    ChoiceLoad: false, // 作業詳細選択肢データのロード
    MemberBackup: false, // 人員データのバックアップ
    MemberLoad: false, // 人員データのロード
    TeamBackup: false, // 班員データのバックアップ
    TeamLoad: false, // 班員データのロード
    InquiryBackup: false, // 問い合わせデータのバックアップ
    InquiryLoad: false, // 問い合わせデータのロード
    SettingBackup: false, // 設定（管理者設定）データのバックアップ
    SettingLoad: false, // 設定（管理者設定）データのロード
    AsyncTaskBackup: false, // 非同期タスクデータのバックアップ
    AsyncTaskDelet: false, // 非同期タスクデータの削除
    HistoryBackup: false, // 操作履歴データのバックアップ
    HistoryDelet: false, // 操作履歴データの削除
  }), []); 

  const [runningStates, setRunningStates] = useState(initialTaskStates); // 処理ごとの実行中フラグ（ボタン表示の切り替えに使う）

  // データ種類ごとのエラーメッセージの初期値（すべて null＝エラーなし）
  const initialErrorStates = useMemo(() => ({
    KosuError: null, DefError: null, ChoiceError: null, MemberError: null, TeamError: null, InquiryError: null,
    SettingError: null, AsyncTaskError: null, HistoryError: null,
  }), []); 
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>(initialErrorStates); // データ種類ごとのエラーメッセージ

  // 期間指定（開始日・終了日）。初期値はどちらも今日
  const today = getTodayDateString();
  const [startDay, setStartDay] = useState<string>(today); // 期間の開始日（"YYYY-MM-DD"）
  const [endDay, setEndDay] = useState<string>(today); // 期間の終了日（"YYYY-MM-DD"）
  const navigate = useNavigate(); // 画面遷移用の関数
  // ロード用に選択されたファイル（未選択なら null）
  const [kosuFile, setKosuFile] = useState<File | null>(null); // 工数データ
  const [defFile, setDefFile] = useState<File | null>(null); // 工数区分定義データ
  const [choiceFile, setChoiceFile] = useState<File | null>(null); // 作業詳細選択肢データ
  const [memberFile, setMemberFile] = useState<File | null>(null); // 人員データ
  const [teamFile, setTeamFile] = useState<File | null>(null); // 班員データ
  const [inquiryFile, setInquiryFile] = useState<File | null>(null); // 問い合わせデータ
  const [settingFile, setSettingFile] = useState<File | null>(null); // 設定データ

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: 管理者権限をAPIで確認する
  useEffect(() => {
    /**
     * 権限確認APIを呼び出し、未ログインならログイン画面へ、権限がなければメインメニューへ遷移する。
     *
     * @returns なし（失敗時は画面遷移、または errorStates の MemberError に反映）
     */
    const checkAuth = async () => {
      try {
        // GET /api/manager_loading/ : 管理者権限の確認（レスポンスの中身は使わない）
        //   管理者でなければサーバーが 403、未ログインなら 401 を返し、下の catch で画面遷移する
        //   ※Django のURL照合は大文字小文字を区別するため、kosu/urls.py の定義（manager_loading/）と
        //     完全に同じ綴りにする必要がある（違うと「React画面を返す」パターンに一致し、権限確認されない）
        await api.get<Member>("/api/manager_loading/");
      } catch (err) {
        const axiosError = err as AxiosError;
        // 401: 未ログイン → ログイン画面へ
        if (axiosError.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (axiosError.response?.status === 403) navigate("/");
        // その他: axios のエラーメッセージを人員データ欄のエラーとして保存（画面上部に表示される）
        else setErrorStates(prev => ({ ...prev, MemberError: axiosError.message }));
      } finally {
        // 成功・失敗どちらでも権限確認中の表示を終了する
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // ---------- state 更新関数を作る関数 ----------

  /**
   * 指定した処理の実行中フラグだけを更新する関数を作る。
   *
   * 例: createSetter('KosuBackup')(true) → runningStates.KosuBackup だけが true になる。
   *
   * @param key - 実行中フラグのキー名（例: 'KosuBackup'）
   * @returns true/false を受け取って、そのキーの実行中フラグを更新する関数
   */
  const createSetter = useCallback((key: keyof typeof initialTaskStates) => (value: boolean) => {
    setRunningStates(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * 指定したデータ種類のエラーメッセージだけを更新する関数を作る。
   *
   * 例: createErrorSetter('KosuError')("失敗") → errorStates.KosuError だけが "失敗" になる。
   *
   * @param key - エラーメッセージのキー名（例: 'KosuError'）
   * @returns メッセージ（または null）を受け取って、そのキーのエラーメッセージを更新する関数
   */
  const createErrorSetter = useCallback((key: keyof typeof initialErrorStates) => (value: string | null) => {
    setErrorStates(prev => ({ ...prev, [key]: value }));
  }, []);

  // ---------- 処理ごとの完了監視関数 ----------

  // 処理ごとに「実行中フラグの更新関数」「エラーの更新関数」「処理の種類」を渡して完了監視関数を作る。
  // フック（use〜）はループや条件分岐の中で呼べないため、1つずつ並べて呼んでいる
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

  // 処理のキー名 → 完了監視関数 の対応表（startTask / startFileLoad でキー名から監視関数を引くために使う）。
  // ※createSetter(...) の戻り値は呼ぶたびに新しい関数になるため、上の監視関数も描画のたびに作り直され、
  //   この useMemo も実際には毎回計算し直される
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

  // ---------- 非同期タスクの開始処理 ----------

  /**
   * バックアップ・削除の非同期タスクを開始し、完了監視を始める。
   *
   * 開始APIが task_id を返したら、対応する完了監視関数に渡す。
   * task_id が返らない、または通信エラーの場合は実行中フラグを戻してエラーを表示する。
   *
   * @param taskKey      - 処理のキー名（例: 'KosuBackup'）
   * @param endpointPath - 開始APIのパス（例: 'kosu_backup' → POST /api/kosu_backup/）
   * @param processName  - メッセージに使う処理名（例: '工数データバックアップ'）
   * @param isDateRanged - true: 期間指定（開始日・終了日）を送る / false: 送らない（省略時 false）
   * @returns なし
   */
  const startTask = useCallback(async (
    taskKey: keyof typeof monitorHooks,
    endpointPath: string,
    processName: string,
    isDateRanged: boolean = false
  ) => {
    // この処理の実行中フラグを更新する関数
    const isRunningSetter = createSetter(taskKey as keyof typeof initialTaskStates);
    // キー名からエラーのキー名を作る（末尾の処理名を取り除いて "Error" を付ける）
    //   例: 'KosuDelet' → 末尾5文字 "Delet" を除く → 'KosuError'
    //       'KosuBackup' → 末尾6文字 "Backup" を除く → 'KosuError'
    const errorKey = taskKey.endsWith('Delet') ?
      `${taskKey.slice(0, -5)}Error` as keyof typeof initialErrorStates :
      `${taskKey.slice(0, -6)}Error` as keyof typeof initialErrorStates;
    const setError = createErrorSetter(errorKey);

    // 前回のエラーメッセージをすべて消す
    setErrorStates(initialErrorStates);

    const endpoint = `/api/${endpointPath}/`;

    // 実行中にする（ボタンが「実行中...」になり、全ボタンが無効になる）
    isRunningSetter(true);

    try {
      // 期間指定ありの処理だけ、開始日・終了日を送信データにする
      const bodyData = isDateRanged ? { start_day: startDay, end_day: endDay } : {};

      // POST /api/<種類>_backup/ など : 非同期タスクを開始（期間指定なしの処理は送信データなし）
      const response = await api.post(endpoint, isDateRanged ? bodyData : undefined);
      const data = response.data;

      // task_id（または taskId）が返ってきたら、その処理の完了監視を始める
      if (data.taskId || (data.status === 'success' && data.task_id)) {
        const taskId = data.taskId || data.task_id;
        monitorHooks[taskKey](taskId);
      } else {
        // タスクIDが返らなかった場合: 実行中を解除してエラーを表示する
        isRunningSetter(false);
        const message = data.message || `${processName}の開始に失敗しました。`;
        setError(message);
        alert(message);
      }
    } catch (err) {
      // 通信エラー、またはサーバーがエラー（400: 日付の指定誤り など）を返した場合:
      // 実行中を解除し、固定の文言でエラーを表示する
      isRunningSetter(false);
      console.error('Error:', err);
      setError(`${processName}の開始中にネットワークエラーが発生しました。`);
      alert(`${processName}の開始に失敗しました。`);
    }
  }, [monitorHooks, startDay, endDay, createSetter, createErrorSetter, initialErrorStates]);

  /**
   * ロード（ファイルからのデータ登録）の非同期タスクを開始し、完了監視を始める。
   *
   * 選択されたファイルを multipart/form-data（ファイル送信用の形式）で送信する。
   * ファイル未選択の場合は案内を出して何もしない。
   *
   * @param taskKey      - 処理のキー名（ロード処理のみ。例: 'KosuLoad'）
   * @param endpointPath - 開始APIのパス（例: 'kosu_load' → POST /api/kosu_load/）
   * @param processName  - メッセージに使う処理名（例: '工数データロード'）
   * @param fileToLoad   - アップロードするファイル（未選択なら null）
   * @returns なし
   */
  const startFileLoad = useCallback(async (
    taskKey: 'KosuLoad' | 'DefLoad' | 'ChoiceLoad' | 'MemberLoad' | 'TeamLoad' | 'InquiryLoad' | 'SettingLoad',
    endpointPath: string,
    processName: string,
    fileToLoad: File | null
  ) => {
    // この処理の実行中フラグを更新する関数
    const isRunningSetter = createSetter(taskKey as keyof typeof initialTaskStates);
    // キー名の末尾4文字 "Load" を除いて "Error" を付ける（例: 'KosuLoad' → 'KosuError'）
    const errorKey = `${taskKey.slice(0, -4)}Error` as keyof typeof initialErrorStates;
    const setError = createErrorSetter(errorKey);

    // 前回のエラーメッセージをすべて消す
    setErrorStates(initialErrorStates);

    // ファイル未選択なら案内を出して終了
    if (!fileToLoad) {
      alert('アップロードするファイルを選択してください。');
      return;
    }

    const endpoint = `/api/${endpointPath}/`;

    // 送信データ: "file" という名前でファイルを入れる（サーバー側は request.FILES.get('file') で受け取る）
    const formData = new FormData();
    formData.append('file', fileToLoad);

    // 実行中にする（ボタンが「実行中...」になり、全ボタンが無効になる）
    isRunningSetter(true);

    try {
      // POST /api/<種類>_load/ : ファイルを送信してロードの非同期タスクを開始
      const response = await api.post(endpoint, formData);
      const data = response.data;

      // task_id（または taskId）が返ってきたら、その処理の完了監視を始める
      if (data.taskId || (data.status === 'success' && data.task_id)) {
        const taskId = data.taskId || data.task_id;
        monitorHooks[taskKey](taskId);
      } else {
        // タスクIDが返らなかった場合: 実行中を解除してエラーを表示する
        isRunningSetter(false);
        const message = data.message || `${processName}の開始に失敗しました。`;
        setError(message);
        alert(message);
      }
    } catch (err) {
      // 通信エラー、またはサーバーがエラー（500: ファイル書き込みエラー など）を返した場合:
      // 実行中を解除し、固定の文言でエラーを表示する
      isRunningSetter(false);
      console.error('Error:', err);
      setError(`${processName}の開始中にネットワークエラーが発生しました。`);
      alert(`${processName}の開始に失敗しました。`);
    }
  }, [monitorHooks, createSetter, createErrorSetter, initialErrorStates]);

  // ---------- イベントハンドラ（各ボタン用） ----------

  // 各「ロード開始」ボタン用: 選択中のファイルを渡して startFileLoad を呼ぶ。
  // useCallback で包み、選択ファイルが変わったときだけ関数を作り直す

  /**
   * 工数データのロードを開始する（POST /api/kosu_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startKosuload = useCallback(() => {
    return startFileLoad('KosuLoad', 'kosu_load', '工数データロード', kosuFile);
  }, [kosuFile, startFileLoad]);

  /**
   * 工数区分定義データのロードを開始する（POST /api/def_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startDefload = useCallback(() => {
    return startFileLoad('DefLoad', 'def_load', '工数区分定義データロード', defFile);
  }, [defFile, startFileLoad]);

  /**
   * 作業詳細選択肢データのロードを開始する（POST /api/choice_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startChoiceload = useCallback(() => {
    return startFileLoad('ChoiceLoad', 'choice_load', '作業詳細選択肢データロード', choiceFile);
  }, [choiceFile, startFileLoad]);

  /**
   * 人員データのロードを開始する（POST /api/member_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startMemberload = useCallback(() => {
    return startFileLoad('MemberLoad', 'member_load', '人員データロード', memberFile);
  }, [memberFile, startFileLoad]);

  /**
   * 班員データのロードを開始する（POST /api/team_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startTeamload = useCallback(() => {
    return startFileLoad('TeamLoad', 'team_load', '班員データロード', teamFile);
  }, [teamFile, startFileLoad]);

  /**
   * 問い合わせデータのロードを開始する（POST /api/inquiry_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startInquiryload = useCallback(() => {
    return startFileLoad('InquiryLoad', 'inquiry_load', '問い合わせデータロード', inquiryFile);
  }, [inquiryFile, startFileLoad]);

  /**
   * 設定データのロードを開始する（POST /api/setting_load/）。
   *
   * @returns startFileLoad の処理結果（Promise）
   */
  const startSettingload = useCallback(() => {
    return startFileLoad('SettingLoad', 'setting_load', '設定データロード', settingFile);
  }, [settingFile, startFileLoad]);

  // 各「バックアップ開始」「削除開始」ボタン用: 処理のキー名・APIパス・処理名を渡して startTask を呼ぶ。
  // 最後の引数 true は「期間指定（開始日・終了日）を送る」処理（工数・非同期タスク・操作履歴）

  /**
   * 工数データのバックアップを開始する（POST /api/kosu_backup/。期間指定あり）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startKosuBackup = () => startTask('KosuBackup', 'kosu_backup', '工数データバックアップ', true);
  /**
   * 工数データの削除を開始する（POST /api/kosu_delet/。期間指定あり）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startKosuDelet = () => startTask('KosuDelet', 'kosu_delet', '工数データ削除', true);
  /**
   * 工数区分定義データのバックアップを開始する（POST /api/def_backup/）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startDefBackup = () => startTask('DefBackup', 'def_backup', '工数区分定義データバックアップ');
  /**
   * 作業詳細選択肢データのバックアップを開始する（POST /api/choice_backup/）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startChoiceBackup = () => startTask('ChoiceBackup', 'choice_backup', '作業詳細選択肢データバックアップ');
  /**
   * 人員データのバックアップを開始する（POST /api/member_backup/）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startMemberBackup = () => startTask('MemberBackup', 'member_backup', '人員データバックアップ');
  /**
   * 班員データのバックアップを開始する（POST /api/team_backup/）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startTeamBackup = () => startTask('TeamBackup', 'team_backup', '班員データバックアップ');
  /**
   * 問い合わせデータのバックアップを開始する（POST /api/inquiry_backup/）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startInquiryBackup = () => startTask('InquiryBackup', 'inquiry_backup', '問い合わせデータバックアップ');
  /**
   * 設定データのバックアップを開始する（POST /api/setting_backup/）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startSettingBackup = () => startTask('SettingBackup', 'setting_backup', '設定データバックアップ');
  /**
   * 非同期タスクデータのバックアップを開始する（POST /api/AsyncTask_backup/。期間指定あり）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startAsyncTaskBackup = () => startTask('AsyncTaskBackup', 'AsyncTask_backup', 'タスク履歴データバックアップ', true);
  /**
   * 非同期タスクデータの削除を開始する（POST /api/AsyncTask_delet/。期間指定あり）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startAsyncTaskDelet = () => startTask('AsyncTaskDelet', 'AsyncTask_delet', 'タスク履歴データ削除', true);
  /**
   * 操作履歴データのバックアップを開始する（POST /api/History_backup/。期間指定あり）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startHistoryBackup = () => startTask('HistoryBackup', 'History_backup', '操作履歴データバックアップ', true);
  /**
   * 操作履歴データの削除を開始する（POST /api/History_delet/。期間指定あり）。
   *
   * @returns startTask の処理結果（Promise）
   */
  const startHistoryDelet = () => startTask('HistoryDelet', 'History_delet', '操作履歴データ削除', true);

  // ---------- 表示用の値 ----------

  // どれか1つでも実行中の処理があるか（true の間は全ボタンを無効にし、ローディング表示を出す）
  const isAnyBackupRunning = Object.values(runningStates).some(state => state);

  // エラーメッセージのうち最初に見つかった1件（なければ undefined）
  const anyError = Object.values(errorStates).find(error => error !== null);

  // ---------- 描画（JSX） ----------

  // 権限確認中は簡易的な読み込み中表示だけを出す
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {/* 処理実行中のローディング表示（どれか1つでも実行中なら表示） */}
      <Loading isLoading={isAnyBackupRunning} />
      <div className={styles["admin-loading-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>データ管理</h1>
        {/* 管理者メニュー画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {/* エラーメッセージ（エラーがあり、かつ実行中の処理がないときだけ表示） */}
        {anyError && !isAnyBackupRunning && (
          <div role="alert" style={{color: 'red', marginTop: '10px'}}>{anyError}</div>
        )}

        {/* 操作欄（期間指定と、データ種類ごとのボタン群） */}
        <div className={styles["search-bar"]}>
          {/* ---------- 期間指定 ---------- */}
          <label htmlFor="start_day">期間指定：</label>
          {/* 開始日 ～ 終了日 の入力欄（工数・非同期タスク・操作履歴のバックアップ/削除で使う） */}
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

          {/* ---------- 工数データ（バックアップ・削除・ロード） ---------- */}
          {/* 各ボタン共通: 実行中は表示を「実行中...」に変え、どれか1つでも実行中なら押せなくする */}
          <label htmlFor="start-kosu-backup">工数データ(バックアップ&削除は日付指定)：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（期間内の工数データをExcelで出力） */}
            <input
              id="start-kosu-backup"
              name="start-kosu-backup"
              type="button"
              value={runningStates.KosuBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startKosuBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["kosu-button"]}
            />
            {/* 削除開始ボタン（期間内の工数データを削除） */}
            <input
              id="start-kosu-delet"
              name="start-kosu-delet"
              type="button"
              value={runningStates.KosuDelet ? "実行中..." : "削除開始"}
              onClick={!isAnyBackupRunning ? startKosuDelet : undefined}
              disabled={isAnyBackupRunning}
              className={styles["kosu-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="kosu-file-upload"
                name="kosu-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setKosuFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示。実行中は半透明＋禁止カーソル） */}
              <label
                htmlFor="kosu-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {kosuFile ? kosuFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
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

          {/* ---------- 工数区分定義データ（バックアップ・ロード） ---------- */}
          <label htmlFor="start-def-backup">工数区分定義データ：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（全件をExcelで出力） */}
            <input
              id="start-def-backup"
              name="start-def-backup"
              type="button"
              value={runningStates.DefBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startDefBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["def-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="def-file-upload"
                name="def-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setDefFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示） */}
              <label
                htmlFor="def-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {defFile ? defFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
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

          {/* ---------- 作業詳細選択肢データ（バックアップ・ロード） ---------- */}
          {/* ※label の htmlFor（start-Choice-backup）とボタンの id（start-choice-backup）は大文字小文字が異なる */}
          <label htmlFor="start-Choice-backup">作業詳細選択肢データ：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（全件をExcelで出力） */}
            <input
              id="start-choice-backup"
              name="start-choice-backup"
              type="button"
              value={runningStates.ChoiceBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startChoiceBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["def-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="choice-file-upload"
                name="choice-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setChoiceFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示） */}
              <label
                htmlFor="choice-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {choiceFile ? choiceFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
              {/* ※「実行中...」表示の判定には ChoiceLoad ではなく DefLoad の実行中フラグを参照している */}
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

          {/* ---------- 人員データ（バックアップ・ロード） ---------- */}
          <label htmlFor="start-member-backup">人員データ：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（全件をExcelで出力） */}
            <input
              id="start-member-backup"
              name="start-member-backup"
              type="button"
              value={runningStates.MemberBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startMemberBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["member-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="member-file-upload"
                name="member-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setMemberFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示） */}
              <label
                htmlFor="member-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {memberFile ? memberFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
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

          {/* ---------- 班員データ（バックアップ・ロード） ---------- */}
          <label htmlFor="start-team-backup">班員データ：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（全件をExcelで出力） */}
            <input
              id="start-team-backup"
              name="start-team-backup"
              type="button"
              value={runningStates.TeamBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startTeamBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["team-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="team-file-upload"
                name="team-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setTeamFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示） */}
              <label
                htmlFor="team-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {teamFile ? teamFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
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

          {/* ---------- 問い合わせデータ（バックアップ・ロード） ---------- */}
          <label htmlFor="start-inquiry-backup">問い合わせデータ：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（全件をExcelで出力） */}
            <input
              id="start-inquiry-backup"
              name="start-inquiry-backup"
              type="button"
              value={runningStates.InquiryBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startInquiryBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["inquiry-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="inquiry-file-upload"
                name="inquiry-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setInquiryFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示） */}
              <label
                htmlFor="inquiry-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {inquiryFile ? inquiryFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
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

          {/* ---------- 設定データ（バックアップ・ロード） ---------- */}
          <label htmlFor="start-setting-backup">設定データ：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（全件をExcelで出力） */}
            <input
              id="start-setting-backup"
              name="start-setting-backup"
              type="button"
              value={runningStates.SettingBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startSettingBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
            {/* ロード用: ファイル選択とロード開始ボタン */}
            <div className={styles["input-column"]}>
              {/* ファイル選択欄（本体は CSS で見えなくし、下の label をクリックして選ばせる） */}
              <input
                id="setting-file-upload"
                name="setting-file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setSettingFile(e.target.files ? e.target.files[0] : null)}
                disabled={isAnyBackupRunning}
                className={styles["hidden-file-input"]}
              />
              {/* ファイル選択ボタンの見た目の label（選択済みならファイル名を表示） */}
              <label
                htmlFor="setting-file-upload"
                className={styles["custom-file-label"]}
                style={{ opacity: isAnyBackupRunning ? 0.6 : 1, cursor: isAnyBackupRunning ? 'not-allowed' : 'pointer' }}
              >
                {settingFile ? settingFile.name : "ファイルを選択 (CSV/XLSX)"}
              </label>
              {/* ロード開始ボタン（ファイル未選択の間も押せない） */}
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

          {/* ---------- 非同期タスクデータ（バックアップ・削除。期間指定） ---------- */}
          <label htmlFor="start-async-backup">タスク履歴データ(日付指定)：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（期間内の非同期タスクデータをExcelで出力） */}
            <input
              id="start-async-backup"
              name="start-async-backup"
              type="button"
              value={runningStates.AsyncTaskBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startAsyncTaskBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
            {/* 削除開始ボタン（期間内の非同期タスクデータを削除） */}
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

          {/* ---------- 操作履歴データ（バックアップ・削除。期間指定） ---------- */}
          <label htmlFor="start-operation-backup">操作履歴データ(日付指定)：</label>
          <div className={styles["input-row"]}>
            {/* バックアップ開始ボタン（期間内の操作履歴データをExcelで出力） */}
            <input
              id="start-operation-backup"
              name="start-operation-backup"
              type="button"
              value={runningStates.HistoryBackup ? "実行中..." : "バックアップ開始"}
              onClick={!isAnyBackupRunning ? startHistoryBackup : undefined}
              disabled={isAnyBackupRunning}
              className={styles["setting-button"]}
            />
            {/* 削除開始ボタン（期間内の操作履歴データを削除） */}
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

// ============================================================
// エクスポート
// ============================================================
export default AdministratorLoading;