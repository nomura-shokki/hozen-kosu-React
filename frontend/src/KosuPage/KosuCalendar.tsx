/**
 * ============================================================
 * ファイル名 : KosuCalendar.tsx
 * 種別       : 画面コンポーネント（勤務入力画面）
 * 概要       : ログイン者本人の1か月分の勤務（就業形態）と直をカレンダー形式でまとめて入力する画面。
 *              各日に入力済みの作業時間帯と残業時間も表示し、工数入力OKの日は緑で塗りつぶす。
 *
 * 主な機能   :
 *   - 年・月の切り替え（選択した年月はサーバーのセッションに保存される）
 *   - 日ごとの勤務・直の入力と一括登録（「勤務登録」）
 *   - 未入力の日に標準の勤務（平日=出勤 / 土日=休日）を一括設定（「標準勤務登録」）
 *   - 週（カレンダーの行）単位で平日の直を一括設定（「直一括入力」）
 *   - 月の合計残業時間の表示
 *   - 日付クリックでその日の工数入力画面へ遷移
 *
 * 使用API    : GET  /api/kosu_calendar/         表示年月の工数データ取得（kosu/views/kosu_views.py の KosuCalendar）
 *              POST /api/kosu_calendar_change/  表示年月の変更（同 KosuCalendarChange）
 *              POST /api/kosu_work_write/       日ごとの勤務・直の一括登録（同 KosuWorkWrite）
 *              POST /api/work_default/          標準勤務の一括設定（同 WorkDefault）
 *              POST /api/tyoku_default/         週単位の直の一括設定（同 TyokuDefault）
 *              POST /api/kosu_link/             工数入力画面で開く就業日の設定（同 KosuLink）
 * 画面URL    : /kosu-calendar                   （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/KosuCalendar.module.css, Components/Loading.tsx,
 *              Components/WorkSelect.tsx, Components/TyokuSelect.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/KosuPage/KosuCalendar.module.css";
import WorkSelect from "../Components/WorkSelect"; // 勤務（就業形態）の選択欄
import TyokuSelect from "../Components/TyokuSelect"; // 直の選択欄

// ============================================================
// 型定義
// ============================================================

/** 表示月の工数データ1日分（GET /api/kosu_calendar/ のレスポンス kosu_data の要素） */
interface Kosu {
  id: number; // 工数データのID（主キー）
  employee_no3: number; // 従業員番号
  name: string; // 氏名
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"）
  work_time: string; // 就業形態（出勤・休日・年休 など）
  time_work: string; // 作業内容（5分ごとの工数区分記号を288文字並べた文字列。"#" は未入力）
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
  over_time: string; // 残業時間（分）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 勤務入力画面。
 *
 * 表示時にサーバーのセッションに保存された年月（未保存なら今月）の工数データを取得し、
 * 日曜始まりのカレンダーに勤務・直の選択欄と作業時間帯を並べて表示する。
 * 各行（週）の右端には、その週の平日にまとめて設定する直の選択欄がある。
 *
 * @returns 勤務入力画面のJSX
 */
const KosuCalendar: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Kosu[]>([]); // 表示月の工数データ（登録済みの日の分だけ）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [isPostingWorkWrite, setIsPostingWorkWrite] = useState<boolean>(false); // 「勤務登録」送信中か（二重送信防止のためボタンを無効化）
  const [isPostingWorkDefault, setIsPostingWorkDefault] = useState<boolean>(false); // 「標準勤務登録」送信中か（同上）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // カレンダー表の外枠の最大の高さ（px）
  const [tableWidth, setTableWidth] = useState<number>(0); // カレンダー表の実際の幅（px）
  const [sessionYear, setSessionYear] = useState<number | null>(null); // 表示中の年（サーバーのセッション値）
  const [sessionMonth, setSessionMonth] = useState<number | null>(null); // 表示中の月（1〜12。サーバーのセッション値）
  // 画面で入力中の勤務・直。キーは就業日（"YYYY-MM-DD"）、値は { work_time: 勤務, tyoku2: 直 }
  // 「勤務登録」ボタンでこの内容がそのままサーバーへ送られる
  const [formData, setFormData] = useState<{ [key: string]: { work_time: string; tyoku2: string; week?: string } }>({});
  // 「直一括」列で選択中の直。インデックス = カレンダーの行番号（0始まり＝第1週）
  const [defaultTyokuValues, setDefaultTyokuValues] = useState<string[]>([]);
  const [totalOverTime, setTotalOverTime] = useState<number>(0); // 表示月の合計残業時間（分）
  // カレンダー表の要素を参照する（表の実際の幅を測るため）
  const tableRef = useRef<HTMLTableElement>(null);
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- データ取得 ----------

  /**
   * 表示年月の工数データを取得し、表示用・入力用の state に保存する。
   *
   * 取得した工数データの勤務・直を formData に入れ、選択欄の初期値にする。
   * 「直一括」列の選択内容は空に戻す。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * useEffect の依存配列や他の useCallback から使うため、useCallback で関数を使い回す。
   *
   * @returns なし（結果は data / sessionYear / sessionMonth / formData などの state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/kosu_calendar/ : セッションの年月（未保存なら今月）のログイン者の工数データを取得
      const response = await api.get("/api/kosu_calendar/");
      const results = response.data.kosu_data || [];
      setData(results);
      setSessionYear(response.data.session_year);
      setSessionMonth(response.data.session_month);
      // 登録済みの勤務・直を、就業日をキーにした入力用データへ詰め替える
      const initialFormData: { [key: string]: { work_time: string; tyoku2: string } } = {};
      results.forEach((item: Kosu) => {
        initialFormData[item.work_day2] = {
          work_time: item.work_time,
          tyoku2: item.tyoku2,
        };
      });
      setFormData(initialFormData);
      // 「直一括」列の選択はリセットする
      setDefaultTyokuValues([]);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [navigate]);

  // ---------- 副作用（useEffect）: 合計残業時間 ----------

  // 工数データが変わったとき: 表示月の残業時間（分）を合計する（残業未入力の日は0として扱う）
  useEffect(() => {
    const totalMinutes = data.reduce((sum, item) => {
      return sum + (item.over_time ? Number(item.over_time) : 0);
    }, 0);
    setTotalOverTime(totalMinutes);
  }, [data]);

  // ---------- イベントハンドラ ----------

  /**
   * 日ごとの勤務・直の選択欄が変わったとき、formData の該当日・該当項目だけを書き換える。
   *
   * @param day   - 就業日（"YYYY-MM-DD"）
   * @param field - 書き換える項目（'work_time': 勤務 / 'tyoku2': 直）
   * @param value - 選択された値
   * @returns なし（結果は formData の state に反映）
   */
  const handleChange = (day: string, field: 'work_time' | 'tyoku2', value: string) => {
    // 直前の formData をコピーし、該当日のもう一方の項目は残したまま指定項目だけ更新する
    setFormData(prevFormData => ({
      ...prevFormData,
      [day]: {
        ...prevFormData[day],
        [field]: value,
      },
    }));
  };
  
  /**
   * 「直一括」列の選択欄が変わったとき、その行（週）の値だけを書き換える。
   *
   * @param rowIndex - カレンダーの行番号（0始まり＝第1週）
   * @param value    - 選択された直の番号
   * @returns なし（結果は defaultTyokuValues の state に反映）
   */
  const handleTyokuDefaultChange = (rowIndex: number, value: string) => {
    // 配列をコピーしてから該当行だけ書き換える（state を直接変更しないため）
    setDefaultTyokuValues(prevValues => {
      const newValues = [...prevValues];
      newValues[rowIndex] = value;
      return newValues;
    });
  };

  /**
   * 表示年月をサーバーのセッションに保存し、その年月のデータを取得し直す。
   *
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * handleYearMonthChange から呼ぶ。fetchData に依存するため useCallback でまとめている。
   *
   * @param year  - 表示する年（例: 2026）
   * @param month - 表示する月（1〜12）
   * @returns なし
   */
  const postYearMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      // POST /api/kosu_calendar_change/ : 表示年月をセッションに保存
      await api.post("/api/kosu_calendar_change/", {
        year: year,
        month: month,
      });
      // 保存した年月の工数データを取得し直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 読み込み中表示を終了する
      setLoading(false);
    }
  }, [fetchData, navigate]);

  /**
   * 「勤務登録」ボタン押下時の処理。画面で入力した勤務・直を一括登録する。
   *
   * サーバー側では表示月の各日について、勤務か直が入っていれば工数データを作成・更新する。
   * 勤務・直が両方空で、作業内容・作業詳細・残業も未入力の工数データは削除される。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @returns なし
   */
  const postWorkWrite = async () => {
    // 送信中はボタンを無効化して二重送信を防ぐ
    setIsPostingWorkWrite(true);
    try {
      // POST /api/kosu_work_write/ : { "YYYY-MM-DD": { work_time, tyoku2 }, ... } の形で日ごとの勤務・直を送信
      await api.post("/api/kosu_work_write/", formData);
      // 登録結果（工数入力OK/NG判定の変化など）を反映するため取得し直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでもボタンを元に戻す
      setIsPostingWorkWrite(false);
    }
  };

  /**
   * 「標準勤務登録」ボタン押下時の処理。表示月の勤務が未入力の日に標準の勤務を設定する。
   *
   * サーバー側では、工数データがない日・勤務が空の日に「平日=出勤 / 土日=休日」を書き込む。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @returns なし
   */
  const postWorkDefault = async () => {
    // 送信中はボタンを無効化して二重送信を防ぐ
    setIsPostingWorkDefault(true);
    try {
      // POST /api/work_default/ : 送信データなし（対象年月はサーバーのセッションから決まる）
      await api.post("/api/work_default/", {});
      // 設定結果を反映するため取得し直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでもボタンを元に戻す
      setIsPostingWorkDefault(false);
    }
  };

  /**
   * 「直一括入力」ボタン押下時の処理。「直一括」列で選んだ直を、その週の平日にまとめて設定する。
   *
   * サーバー側では、各平日の「月の第何週か（日曜始まり）」に対応する直を、
   * 工数データがない日・直が空の日にだけ書き込む（入力済みの直は上書きしない）。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @returns なし
   */
  const handleDefaultTyokuPost = async () => {
    try {
      // 送信データを作成: 行番号0 → default_tyoku1（第1週）、行番号1 → default_tyoku2（第2週）…
      // 一度も選択していない行は配列の空き要素になり、reduce で飛ばされるため送信されない
      const postData: { [key: string]: string } = defaultTyokuValues.reduce((acc: { [key: string]: string }, tyoku, index) => {
        acc[`default_tyoku${index + 1}`] = tyoku;
        return acc;
      }, {});
  
      // POST /api/tyoku_default/ : 週ごとの直を送信し、平日の直を一括設定
      await api.post("/api/tyoku_default/", postData);
      // 設定結果を反映するため取得し直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  /**
   * カレンダーの日付クリック時の処理。その日を工数入力画面の就業日に設定して遷移する。
   *
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @param dayValue - クリックされた日付（"YYYY-MM-DD"）
   * @returns なし
   */
  const handleDayClick = async (dayValue: string) => {
    try {
      // POST /api/kosu_link/ : 工数入力画面で開く就業日をセッションに保存
      await api.post("/api/kosu_link/", {
        day: dayValue,
      });
      // 工数入力画面へ遷移（セッションの就業日で開かれる）
      navigate("/kosu-new");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  // ---------- 副作用（useEffect）: データ取得・表のサイズ ----------

  // 初回表示時（fetchData は navigate が変わらない限り同じ関数のため実質1回）: 工数データを取得する
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 初回表示時: 表の外枠の最大の高さをウィンドウの高さに合わせ、以後はウィンドウサイズ変更のたびに更新する
  useEffect(() => {
    /**
     * 表の外枠の最大の高さをウィンドウの高さに更新する。
     *
     * @returns なし（結果は maxHeight の state に反映）
     */
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight);
    };

    // まず現在のサイズで1回計算する
    updateMaxHeight();

    // ウィンドウサイズ変更時にも計算し直すよう登録する
    window.addEventListener("resize", updateMaxHeight);

    // 画面を離れるときに登録を解除する
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // 工数データが変わったとき（表の中身が変わったとき）: 表の実際の幅を測り直す
  // 以後はウィンドウサイズ変更のたびにも測り直す
  useEffect(() => {
    /**
     * カレンダー表の実際の幅を測って tableWidth に保存する。
     *
     * @returns なし（結果は tableWidth の state に反映）
     */
    const updateTableWidth = () => {
      // 表がまだ描画されていない（ref が空）場合は何もしない
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    // まず現在のサイズで1回測る
    updateTableWidth();
    // ウィンドウサイズ変更時にも測り直すよう登録し、再実行の前・画面を離れるときに解除する
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [data]);

  // ---------- ヘルパー関数（表示用データの作成） ----------

  /**
   * 指定年月のカレンダー（日曜始まり・1行7日）の行データを作る。
   *
   * 1日より前の曜日と、月末より後ろの曜日は null（空欄）で埋めて、各行がちょうど7マスになるようにする。
   * 例: 2026年11月（1日が日曜・30日まで）→ [[1..7], [8..14], [15..21], [22..28], [29, 30, null×5]]
   *
   * @param year  - 年（例: 2026）
   * @param month - 月（1〜12）
   * @returns 行（週）ごとの日付の配列。空欄は null
   */
  const generateCalendar = (year: number, month: number) => {
    // Date の月は0始まりのため month - 1 で「その月の1日」になる
    const firstDayOfMonth = new Date(year, month - 1, 1);
    // 翌月の「0日」を指定すると、その月の末日になる
    const lastDayOfMonth = new Date(year, month, 0);
    // 1日の曜日（0=日曜〜6=土曜）。この数だけ先頭に空欄を入れる
    const firstDayOfWeek = firstDayOfMonth.getDay();
    // その月の日数（28〜31）
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // カレンダーのマス目を1列に並べた配列（日付 or 空欄 null）
    const calendarCells: (number | null)[] = [];

    // 1日より前の曜日を空欄で埋める
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarCells.push(null);
    }

    // 1日〜末日を並べる
    for (let i = 1; i <= totalDaysInMonth; i++) {
      calendarCells.push(i);
    }

    // 最終行の残りマスを空欄で埋めて7の倍数にする（ちょうど7の倍数なら remainingCells は7で、何もしない）
    const remainingCells = 7 - (calendarCells.length % 7);
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        calendarCells.push(null);
      }
    }

    // 1列の配列を7マスずつ区切って行（週）の配列にする
    const rows: (number | null)[][] = [];
    let currentRow: (number | null)[] = [];

    calendarCells.forEach((cell, index) => {
      currentRow.push(cell);
      // 7マスたまったら1行として確定し、次の行を始める
      if (currentRow.length === 7) {
        rows.push(currentRow);
        currentRow = [];
      }
    });

    return rows;
  };

  /**
   * 作業内容の文字列から、作業が入っている時間帯（"H:MM～H:MM"）を最大4つ取り出して表示用にする。
   *
   * 作業内容は1文字が5分を表す288文字（24時間 × 12）で、インデックス i が 0:00 から i×5 分後の時刻に対応する。
   * "#"（未入力）以外の文字が連続している区間を1つの時間帯とみなす（"$"＝休憩も区間に含まれる）。
   * 例: インデックス96〜155が入力済み → "8:00～13:00"
   * 時間帯が4つ未満の場合は全角スペースの行で埋め、どの日のマスも同じ行数（高さ）にそろえる。
   *
   * @param timeWorkString - 作業内容の文字列（288文字でない場合は時間帯なしとして扱う）
   * @returns 時間帯を1行ずつ表示する div 要素の配列（必ず4要素）
   */
  const formatTimeWork = (timeWorkString: string) => {
    const timeRanges: string[] = []; // 見つかった時間帯の文字列
    let start = -1; // 現在の区間の開始インデックス（-1 は区間外）
    let inTimeBlock = false; // 現在、作業が入っている区間の中にいるか

    // 正しい長さ（288文字）の作業内容だけを処理する
    if (timeWorkString && timeWorkString.length === 288) {
      for (let i = 0; i < timeWorkString.length; i++) {
        // 未入力 → 入力済み に変わった位置: 区間の開始として記録する
        if (timeWorkString[i] !== '#' && !inTimeBlock) {
          start = i;
          inTimeBlock = true;
        // 入力済み → 未入力 に変わった位置: 直前（i - 1）までを1つの区間として確定する
        } else if (timeWorkString[i] === '#' && inTimeBlock) {
          const end = i - 1;
          // インデックス → 時刻: 12マスで1時間、1マス5分（例: 102 → 8時30分）
          const startHour = Math.floor(start / 12);
          const startMinute = (start % 12) * 5;
          // 終了時刻は最後のマスの「終わり」なので +5分する（例: 155 → 12:55 + 5分 = 13:00）
          let endHour = Math.floor(end / 12);
          let endMinute = (end % 12) * 5 + 5;

          // +5分で60分になった場合は次の時の0分に繰り上げる
          if (endMinute === 60) {
            endHour++;
            endMinute = 0;
          }

          // "H:MM" 形式にする（時は0埋めしない、分は2桁に0埋め）
          const startTimeStr = `${String(startHour).padStart(1, '0')}:${String(startMinute).padStart(2, '0')}`;
          const endTimeStr = `${String(endHour).padStart(1, '0')}:${String(endMinute).padStart(2, '0')}`;
          timeRanges.push(`${startTimeStr}～${endTimeStr}`);
          // 区間外の状態に戻す
          inTimeBlock = false;
          start = -1;
        }
      }

      // 最後のマス（23:55〜24:00）まで作業が続いていた場合: 終了時刻を 24:00 として区間を確定する
      if (inTimeBlock) {
        const startHour = Math.floor(start / 12);
        const startMinute = (start % 12) * 5;

        const startTimeStr = `${String(startHour).padStart(1, '0')}:${String(startMinute).padStart(2, '0')}`;
        const endTimeStr = '24:00';
        timeRanges.push(`${startTimeStr}～${endTimeStr}`);
      }
    }

    // 表示は先頭4つまで。足りない分は全角スペースで埋めて必ず4行にする
    const paddedRanges = timeRanges.slice(0, 4);
    while (paddedRanges.length < 4) {
      paddedRanges.push("　");
    }

    // 1時間帯につき1行の div にする（key には行番号を使う）
    return paddedRanges.map((range, index) => (
      <div key={index}>{range}</div>
    ));
  };

  /**
   * 年・月の選択欄が変わったときの処理。変更した方だけ差し替えて表示年月を変更する。
   *
   * @param e - 年または月の選択欄の変更イベント（name 属性で "year" / "month" を判別する）
   * @returns なし
   */
  const handleYearMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    // 年を変えた場合: 新しい年 + 表示中の月
    if (name === "year" && sessionMonth !== null) {
      postYearMonth(Number(value), sessionMonth);
    // 月を変えた場合: 表示中の年 + 新しい月
    } else if (name === "month" && sessionYear !== null) {
      postYearMonth(sessionYear, Number(value));
    }
  };

  /**
   * 年の選択欄に並べる年の一覧を作る（今年の前後5年、計11年分）。
   *
   * @returns 年の配列（例: 今年が2026年なら [2021, 2022, ..., 2031]）
   */
  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  // 表示年月が分かっていればカレンダーの行データを作る（未取得の間は空）
  const calendarRows = sessionYear && sessionMonth ? generateCalendar(sessionYear, sessionMonth) : [];

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す（読み込み中よりも優先して判定する）
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["kosu-calendar-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>勤務入力</h1>
        {/* 工数メニュー画面へ戻るリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>

        {/* 表示年月の選択欄（変更するとセッションに保存してデータを取得し直す） */}
        <div className={styles["year-month-selector"]}>
          {/* 年の選択欄: 今年の前後5年を表示 */}
          <select
            name="year"
            value={sessionYear || ""}
            onChange={handleYearMonthChange}
          >
            {getYears().map(year => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
          {/* 月の選択欄: 1月〜12月を表示（[...Array(12)] で12要素の配列を作り、インデックス + 1 を月にする） */}
          <select
            name="month"
            value={sessionMonth || ""}
            onChange={handleYearMonthChange}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}月
              </option>
            ))}
          </select>
        </div>
        {/* 一括登録ボタン群 */}
        <div className={styles["button-wrapper"]}>
          {/* 勤務登録: 画面で入力した勤務・直を一括登録（送信中は無効化し「送信中...」と表示） */}
          <button
            onClick={postWorkWrite}
            disabled={isPostingWorkWrite}
            className="light_blue_button"
          >
            {isPostingWorkWrite ? '送信中...' : '勤務登録'}
          </button>
          
          {/* 標準勤務登録: 勤務が未入力の日に 平日=出勤 / 土日=休日 を設定（送信中は無効化） */}
          <button
            onClick={postWorkDefault}
            disabled={isPostingWorkDefault}
            className="light_blue_button"
          >
            標準勤務登録
          </button>
          
          {/* 直一括入力: 「直一括」列で選んだ直を各週の平日にまとめて設定 */}
          <button
            onClick={handleDefaultTyokuPost}
            className="light_blue_button"
          >
            直一括入力
          </button>
        </div>

        {/* 表示月の合計残業時間: 分を時間に換算し小数第2位まで表示（例: 90分 → 1.50H） */}
        <div className={styles["total-overtime"]}>
          <h2>合計残業時間: {(totalOverTime / 60).toFixed(2)}H</h2>
        </div>

        {/* 操作説明 */}
        <p>工数入力OKの日は緑に塗りつぶされます。</p>
        <p>※日付を押すと該当日の工数入力画面に遷移します。</p>
        {/* カレンダー表の外枠: 高さはウィンドウの高さまで（超えたら縦スクロール）、幅は表の実寸 + 20px */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            width: `${tableWidth + 20}px`,
          }}
        >
          <table ref={tableRef}>
            {/* 見出し行: 日曜〜土曜（日曜はピンク・土曜は青・平日は水色の背景）と「直一括」列 */}
            <thead>
              <tr>
                <th className={styles["th-collar3"]}>日</th>
                <th className={styles["th-collar1"]}>月</th>
                <th className={styles["th-collar1"]}>火</th>
                <th className={styles["th-collar1"]}>水</th>
                <th className={styles["th-collar1"]}>木</th>
                <th className={styles["th-collar1"]}>金</th>
                <th className={styles["th-collar2"]}>土</th>
                <th className={styles["th-collar1"]}>直一括</th>
              </tr>
            </thead>
            {/* 本体: カレンダーの1週を1行として表示（key には行番号を使う） */}
            <tbody>
              {calendarRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {/* 1日分のマス: 日曜〜土曜の7マスを表示（key には列番号を使う） */}
                  {row.map((day, colIndex) => {
                    // このマスの日付を "YYYY-MM-DD" にする（空欄のマスは null）
                    const formattedDay = day !== null ? `${sessionYear}-${String(sessionMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    // この日の工数データ（未登録の日は undefined / 空欄のマスは null）
                    const dayData = formattedDay ? data.find(item => item.work_day2 === formattedDay) : null;
                    // この日の入力中の勤務・直（未入力の日は両方空文字）
                    const formDataForDay = formattedDay ? formData[formattedDay] || { work_time: "", tyoku2: "" } : null;

                    // 工数入力OKの日はマスを黄緑（#ADFF2F）で塗りつぶす
                    return (
                      <td
                        key={colIndex}
                        style={{ backgroundColor: dayData?.judgement ? '#ADFF2F' : '' }}
                      >
                        {/* 日付があるマスは入力欄などを表示し、空欄のマスは空の div を表示 */}
                        {day !== null ? (
                          <div>
                            {/* 日付（クリックするとその日の工数入力画面へ遷移） */}
                            <div onClick={() => handleDayClick(formattedDay!)}>
                              {day}
                            </div>
                            <div>
                              {/* 勤務の選択欄（mode='ALL': 休日・年休なども含む全ての勤務を選べる） */}
                              <div className={styles["work-tyoku"]}>
                                <WorkSelect
                                  id={`work_time-${day}`}
                                  value={formDataForDay?.work_time || ""}
                                  onChange={(e) => handleChange(formattedDay!, 'work_time', e.target.value)}
                                  mode='ALL'
                                />
                              </div>
                              {/* 直の選択欄 */}
                              <div className={styles["work-tyoku"]}>
                                <TyokuSelect
                                  id={`tyoku-${day}`}
                                  value={formDataForDay?.tyoku2 || ""}
                                  onChange={(e) => handleChange(formattedDay!, 'tyoku2', e.target.value)}
                                />
                              </div>
                              {/* 作業が入っている時間帯（最大4行） */}
                              <div>
                                {formatTimeWork(dayData ? dayData.time_work : "")}
                              </div>
                              {/* 残業がある日は残業時間を時間単位で表示（例: 残業:1.50H）、ない日は全角スペース */}
                              {dayData?.over_time && Number(dayData.over_time) > 0 ? (
                                <div>
                                  残業:{(Number(dayData.over_time) / 60).toFixed(2)}H
                                </div>
                              ) : "　"}
                            </div>
                          </div>
                        ) : (
                          <div></div>
                        )}
                      </td>
                    );
                  })}
                  {/* 行の右端「直一括」列: この週の平日にまとめて設定する直の選択欄 */}
                  <td>
                    <div className={styles["work-tyoku"]}>
                      <TyokuSelect
                        id={`tyoku-default-${rowIndex}`}
                        value={defaultTyokuValues[rowIndex] || ""}
                        onChange={(e) => handleTyokuDefaultChange(rowIndex, e.target.value)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuCalendar;