/**
 * ============================================================
 * ファイル名 : KosuNew.tsx
 * 種別       : 画面コンポーネント（工数入力画面）
 * 概要       : ログイン者本人の工数を「作業時間帯 + 工数区分 + 作業詳細」の単位で1件ずつ追加入力する画面。
 *              就業日はサーバーのセッションに保存された日付（未設定なら今日）で、日付欄から切り替えられる。
 *              入力済みの工数は、時間帯別の一覧表・グラフ・工数区分の凡例で画面下部に表示する。
 *
 * 主な機能   :
 *   - 就業日の切り替え（サーバーのセッションに保存）と工数入力OK/NG判定の表示
 *   - 勤務・直・工数区分・作業詳細（選択 or 手入力）・作業時間・残業時間を入力して登録
 *   - 入力内容のチェック（必須項目・作業時間の長さ・残業の単位・作業詳細の文字数 など）
 *   - 残業時間だけの登録
 *   - 直・就業日を変えたときに作業時間の初期値を直ごとに決められた時刻にする
 *   - 前回登録した終了時刻を次回の開始時刻として引き継ぐ（ブラウザの localStorage に保存）
 *
 * 使用API    : GET  /api/kosu_new/   入力画面の初期データ取得（kosu/views/kosu_views.py の KosuNew）
 *              POST /api/kosu_new/   工数の追加登録（同上）
 *              POST /api/set_day/    就業日の切り替え（同 SetDay）
 *              POST /api/over_time/  残業時間のみ登録（同 OverTime）
 * 画面URL    : /kosu-new             （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/KosuNew.module.css, Components/Loading.tsx,
 *              Components/TyokuSelect.tsx, Components/WorkSelect.tsx, Components/DefSelect.tsx,
 *              Components/KosuDisplay.tsx, Components/KosuBarChart.tsx, Components/DefTable.tsx,
 *              KosuPage/TodayBreakTime.tsx（休憩変更登録の遷移先）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers"; // 時刻選択欄に日付ライブラリを渡す外枠（MUI部品）
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"; // 日付ライブラリ date-fns を MUI の時刻選択欄で使うためのアダプター
import { MobileTimePicker } from "@mui/x-date-pickers"; // ダイアログ形式の時刻選択欄（MUI部品）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import Loading from "../Components/Loading"; // 読み込み中の表示
import TyokuSelect from "../Components/TyokuSelect"; // 直の選択欄
import WorkSelect from "../Components/WorkSelect"; // 勤務（就業形態）の選択欄
import DefSelect from "../Components/DefSelect"; // 工数区分の選択欄
import KosuDisplay from "../Components/KosuDisplay"; // 作業内容を時間帯ごとに一覧表示する表
import KosuBarChart from "../Components/KosuBarChart"; // 作業内容を時刻ごとに色分けして表示するグラフ
import DefTable from "../Components/DefTable"; // 工数区分名と色の対応表（グラフの凡例）
import styles from "../styles/KosuPage/KosuNew.module.css";

// ============================================================
// 型定義
// ============================================================

/**
 * 工数データ（GET /api/kosu_new/ のレスポンス kosu_data）兼 画面の入力値。
 *
 * この画面では time_work / detail_work を「これから追加する1件分の入力値」として使う
 * （time_work = 選択した工数区分の記号1文字、detail_work = 作業詳細の文字列）。
 * 登録済みの作業内容・作業詳細（288マス分の文字列）は initialTimeWork / initialWorkDetail に別途保持する。
 */
interface Kosu {
  id: string; // 工数データのID（主キー）。工数編集画面へのリンクに使う
  employee_no3: number; // 従業員番号
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"）
  time_work: string; // 入力中の工数区分の記号（"A"〜"x"、"$"=休憩、""=未選択）
  detail_work: string; // 入力中の作業詳細
  over_time: number; // 残業時間（分）
  work_time: string; // 就業形態（出勤・休出・半前年休 など）
  def_ver2: string; // この工数データの入力に使った工数区分定義Ver
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
  break_change: boolean; // 休憩変更チェック（true: 休憩時間帯にも工数を入力できるようにする）
}

/** 工数区分定義（GET /api/kosu_new/ のレスポンス def_data）。キーは kosu_title_1 などの項目名 */
interface DefData {
  [key: string]: string | undefined; // 項目名 → 値（例: kosu_title_1 → 工数区分名）
}

/** 作業詳細の選択肢1件分（GET /api/kosu_new/ のレスポンス detail_list の要素） */
interface DetailData {
  def_symbol: string; // この作業詳細が属する工数区分の記号（"A"〜"x"、"$"=休憩）
  def_select: string; // 作業詳細の文言
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 時刻を5分単位に切り捨て、日付部分を就業日に置き換える。
 *
 * 時刻選択欄が5分刻みのため、それに合わせて分を切り捨てる（例: 8:43 → 8:40）。秒・ミリ秒は0にする。
 * 引数の date 自体を書き換えて返す点に注意。
 *
 * @param date    - 元の時刻（この Date が直接書き換えられる）
 * @param workDay - 就業日（年・月・日だけを使う）
 * @returns 5分単位に切り捨て、日付を就業日にした Date（引数 date と同じもの）
 */
const roundToNearestFiveMinutes = (date: Date, workDay: Date): Date => {
  // 分を5で割って切り捨て、5を掛け直す（例: 43分 → 8 × 5 = 40分）
  const minutes = Math.floor(date.getMinutes() / 5) * 5;
  date.setMinutes(minutes, 0, 0);
  // 年 → 月 → 日 の順に就業日の値で上書きする
  date.setFullYear(workDay.getFullYear());
  date.setMonth(workDay.getMonth());
  date.setDate(workDay.getDate());
  return date;
};

/**
 * API通信エラーの詳しい内容（ステータスコード・ステータス文言・レスポンス本文）を複数行の文字列にする。
 *
 * サーバーがメッセージを返さないエラー（403 など）の原因を画面上で確認できるようにするために使う。
 *
 * @param err - catch で受け取ったエラー
 * @returns 表示用のエラー詳細文字列（例: "HTTP Status: 403\nStatus Text: Forbidden\nResponse Data:\n{...}"）
 */
const formatApiError = (err: unknown): string => {  
  // axios の通信エラー以外は詳細が取れないため固定文言を返す
  if (!axios.isAxiosError(err)) {  
    return "不明なエラーが発生しました。";  
  }  
  // ステータスコード・ステータス文言（応答がない場合は "なし"）
  const status = err.response?.status ?? "なし";  
  const statusText = err.response?.statusText ?? "なし";  
  const responseData = err.response?.data;  
  // レスポンス本文: 文字列ならそのまま、オブジェクトなら見やすく整形した JSON 文字列にする
  let responseBody = "レスポンス本文なし";  
  if (typeof responseData === "string") {  
    responseBody = responseData;  
  } else if (responseData !== undefined && responseData !== null) {  
    try {  
      // 2文字インデントで整形した JSON 文字列に変換する
      responseBody = JSON.stringify(responseData, null, 2);  
    } catch {  
      // JSON に変換できない値（循環参照など）は String() で文字列化する
      responseBody = String(responseData);  
    }  
  }  
  // 各項目を改行でつないで1つの文字列にする
  return [  
    `HTTP Status: ${status}`,  
    `Status Text: ${statusText}`,  
    `Response Data:`,  
    responseBody,  
  ].join("\n");  
};  

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数入力画面。
 *
 * 表示時にセッションの就業日の工数データ・工数区分定義・作業詳細の選択肢を取得する。
 * フォームで「作業時間帯・工数区分・作業詳細」を指定して「更新」を押すと、その時間帯の工数が追加される。
 * 登録後は、今回の終了時刻を次の開始時刻にして続けて入力できるようにする。
 *
 * @returns 工数入力画面のJSX
 */
const KosuNew: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [data, setData] = useState<Kosu | null>(null); // 工数データ兼 入力中の値（型定義の説明を参照）
  const [defData, setDefData] = useState<DefData>({}); // 工数区分定義データ（工数区分の選択肢・表示名に使う）
  const [detailList, setDetailList] = useState<DetailData[]>([]); // 作業詳細の選択肢リスト（全工数区分分）
  // 作業詳細の入力方法（false: 選択肢から選ぶ / true: 手入力）。名前と意味が逆に見えるので注意
  const [isDetailSelectMode, setIsDetailSelectMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [warningMessage, setWarningMessage] = useState<string | null>(null); // 警告メッセージ（使用中の工数区分定義Verが最新でない場合など）
  const [memberName, setMemberName] = useState<string>(""); // ログイン者の氏名（画面タイトルに表示）
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null); // 登録済みの作業内容（288マス分。表・グラフ表示用）
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null); // 登録済みの作業詳細（"$" 区切り。表表示用）
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null); // 登録済みの直（表・グラフの表示時間帯の決定に使う）
  const [memberShop, setMemberShop] = useState<string>(""); // ログイン者のショップ（直ごとの始業時刻や表示時間帯の決定に使う）
  const [isBreakChangeChecked, setIsBreakChangeChecked] = useState<boolean>(false); // 「休憩時間工数入力可」スイッチの状態
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // 登録成功メッセージ（1秒後に消える）
  // 直前の直と就業日を覚えておく（直・就業日が「変わった」ことを検知するため）
  // 値が変わっても再描画は不要なので、state ではなく ref で保持する
  const prevTyokuRef = useRef<string | null>(null);
  const prevWorkDayRef = useRef<string | null>(null);
  // 作業時間の開始時刻（time1）と終了時刻（time2）
  // 初期値: localStorage（ブラウザに保存される領域）に前回の時刻があればそれを、なければ現在時刻を5分単位に切り捨てたもの
  // （この初期化の時点では data は常に null のため、日付部分は今日になる）
  const [selectedTimes, setSelectedTimes] = useState<{
    time1: Date | null;
    time2: Date | null;
  }>({
    time1: (() => {
      const cachedTime1 = localStorage.getItem("time1");
      const workDay = data ? new Date(data.work_day2) : new Date();
      return cachedTime1 ? new Date(cachedTime1) : roundToNearestFiveMinutes(new Date(), workDay);
    })(),
    time2: (() => {
      const cachedTime2 = localStorage.getItem("time2");
      const workDay = data ? new Date(data.work_day2) : new Date();
      return cachedTime2 ? new Date(cachedTime2) : roundToNearestFiveMinutes(new Date(), workDay);
    })(),
  });

  // ---------- 作業時間の操作 ----------

  /**
   * 作業時間の時刻選択欄が変わったとき、開始または終了時刻を更新する。
   *
   * @param field   - 更新する項目（"time1": 開始時刻 / "time2": 終了時刻）
   * @param newTime - 選択された時刻
   * @returns なし（結果は selectedTimes の state に反映）
   */
  const handleTimeChange = (
    field: "time1" | "time2",
    newTime: Date | null
  ) => {
    setSelectedTimes((prev) => ({ ...prev, [field]: newTime }));
  };

  /**
   * 作業時間を localStorage に保存する（次にこの画面を開いたときの初期値にするため）。
   *
   * @param time1 - 保存する開始時刻（null なら保存しない）
   * @param time2 - 保存する終了時刻（null なら保存しない）
   * @returns なし
   */
  const updateCachedTimes = (time1: Date | null, time2: Date | null) => {
    if (time1) localStorage.setItem("time1", time1.toISOString());
    if (time2) localStorage.setItem("time2", time2.toISOString());
  };

  // ---------- データ取得 ----------

  /**
   * 工数入力画面の初期データを取得し、state に保存する。
   *
   * 入力欄（工数区分・作業詳細）は空にし、登録済みの作業内容・作業詳細は表示用の state に分けて保存する。
   * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * useEffect の依存配列や他の処理から呼ぶため、useCallback で関数を使い回す。
   *
   * @returns なし（結果は data / defData / detailList などの state に反映）
   */
  const fetchData = useCallback(async () => {
    try {
      // GET /api/kosu_new/ : セッションの就業日（未設定なら今日）の工数データ・工数区分定義・
      //                      作業詳細の選択肢・ログイン者の人員データを取得
      const response = await api.get("/api/kosu_new/");
      // 使用中の工数区分定義Verが最新でない場合、サーバーから警告文が届く
      setWarningMessage(response.data.warning || null);
      // 工数データが返らなかった場合に備えた空の仮データ
      const kosu_data = response.data.kosu_data || {
        employee_no3: 0,
        work_day2: "",
        tyoku2: "",
        time_work: "",
        detail_work: "",
        over_time: 0,
        work_time: "",
        judgement: false,
        break_change: false,
      };
      // 就業日はセッションの値を使う。工数区分・作業詳細の入力欄は空にする
      const sessionDay = response.data.session_day || "";
      setData({
        ...kosu_data,
        work_day2: sessionDay,
        time_work: "",
        detail_work: "",
      });
      const def_data = response.data.def_data || {};
      setDefData(def_data);
      
      const detail_list = response.data.detail_list || [];
      setDetailList(detail_list);

      // ログイン者の氏名とショップを保存する（値があるときだけ）
      const member_data = response.data.member_data;
      if (member_data?.name) {
        setMemberName(member_data.name);
      }
      if (member_data?.shop) {
        setMemberShop(member_data.shop);
      }
      // 登録済みの作業内容・作業詳細・直を表・グラフ表示用に保存する
      setInitialTimeWork(kosu_data.time_work);
      setInitialWorkDetail(kosu_data.detail_work);
      setInitialTyoku(kosu_data.tyoku2);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 同じ日の工数データが複数ある など）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * フォームの各入力欄（就業日・勤務・直・工数区分・作業詳細・残業時間）が変わったときの共通処理。
   *
   * 入力欄の name 属性をキーにして data の該当項目を書き換える。加えて次の連動処理を行う。
   *   - 工数区分を変えた: 選択中の作業詳細が別の工数区分のものなら、作業詳細を空にする
   *   - 作業詳細を選択肢から選んだ: その作業詳細が属する工数区分を自動で選ぶ
   *   - 就業日を変えた: サーバーのセッションの就業日を切り替え、その日のデータを取得し直す
   *
   * @param event - 入力欄の変更イベント（name 属性で項目を判別する）
   * @returns なし（結果は data の state に反映）
   */
  const handleChange = async (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (data) {
      // 残業時間は数値に変換する（数値にできない・空の場合は0）。それ以外は文字列のまま
      let updatedData = { ...data, [name]: name === "over_time" ? parseInt(value, 10) || 0 : value };

      // 工数区分を変えた場合: 選択中の作業詳細が別の工数区分の選択肢なら、作業詳細を空にする
      if (name === "time_work" && value !== "") {
        const currentDetail = detailList.find(d => d.def_select === data.detail_work);
        if (currentDetail && currentDetail.def_symbol !== value) {
          updatedData.detail_work = "";
        }
      }

      // 作業詳細を選択肢から選んだ場合（手入力モードでない場合）: その作業詳細の工数区分を自動で選ぶ
      if (name === "detail_work" && !isDetailSelectMode) {
        const selectedDetail = detailList.find(d => d.def_select === value);
        if (selectedDetail) {
          updatedData.time_work = selectedDetail.def_symbol;
        }
      }

      setData(updatedData);

      // 就業日を変えた場合: サーバー側の就業日を切り替えてから、その日のデータを取得し直す
      if (name === "work_day2") {
        try {
          // POST /api/set_day/ : セッションの就業日を更新（空なら400エラー「就業日が未指定です。」）
          await api.post("/api/set_day/", { day: value || "" });
          fetchData();
        } catch (err) {
          // サーバーからの応答があるエラー: ステータスコードで処理を分ける
          if (axios.isAxiosError(err)) {
            // 401: 未ログイン → ログイン画面へ
            if (err.response?.status === 401) navigate("/login");
            // 403: 権限なし → メインメニューへ
            else if (err.response?.status === 403) navigate("/");
            // その他（400: 就業日が未指定）: サーバーが返したメッセージを表示
            else setErrorMessage(err.response?.data.message);
          // 通信以外の予期しないエラー
          } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      }
    }
  };

  /**
   * 「現在時刻」ボタン押下時の処理。終了時刻を現在時刻（5分単位に切り捨て）にする。
   *
   * @returns なし（結果は selectedTimes の state に反映）
   */
  const setTime2ToCurrentRounded = () => {
    if (data) {
      const workDay = new Date(data.work_day2);
      const now = roundToNearestFiveMinutes(new Date(), workDay);
      setSelectedTimes((prev) => ({ ...prev, time2: now }));
    }
  };

  /**
   * 「更新」ボタン押下時の処理。入力内容をチェックし、問題なければ工数を追加登録する。
   *
   * チェック内容（引っかかったらエラーを表示して送信しない）:
   *   - 勤務・直・工数区分・作業詳細・開始/終了時刻がすべて入力されている
   *   - 開始時刻と終了時刻が同じでない
   *   - 作業時間が13時間未満（終了が開始より前なら日またぎとして計算）
   *   - 残業時間の単位（休出以外は15分単位、休出は5分単位）
   *   - 作業詳細が100文字以内で、区切り文字の「$」を含まない
   * 登録に成功したら、今回の終了時刻を次の開始時刻にして入力欄を空に戻す。
   * 401（未ログイン）ならログイン画面へ遷移し、403 はエラー詳細を画面に表示する。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止める
    event.preventDefault();
    if (!data) return;

    // 開始・終了時刻の日付部分を就業日にそろえる（state の Date を直接書き換えている）
    const workDay = new Date(data.work_day2);
    if (selectedTimes.time1) {
      selectedTimes.time1.setFullYear(workDay.getFullYear());
      selectedTimes.time1.setMonth(workDay.getMonth());
      selectedTimes.time1.setDate(workDay.getDate());
    }
    if (selectedTimes.time2) {
      selectedTimes.time2.setFullYear(workDay.getFullYear());
      selectedTimes.time2.setMonth(workDay.getMonth());
      selectedTimes.time2.setDate(workDay.getDate());
    }

    // 送信用に UTC の日時文字列へ変換する（例: 日本時間 8:00 → "2026-11-08T23:00:00.000Z"）
    // サーバー側で日本時間に戻し、時・分だけを使う
    const formattedTime1 = selectedTimes.time1?.toISOString();
    const formattedTime2 = selectedTimes.time2?.toISOString();
    const overTime = data.over_time || 0;

    // 必須項目チェック: 勤務・直・工数区分・作業詳細・開始/終了時刻のどれかが空ならエラー
    if (!data.work_time || !data.tyoku2 || !data.time_work || !data.detail_work || !formattedTime1 || !formattedTime2 || !selectedTimes.time1 || !selectedTimes.time2) {
      setErrorMessage("入力必要項目が入力されていません。");
      return;
    }
    // 開始時刻と終了時刻が同じ（作業時間0分）ならエラー
    if (formattedTime1 === formattedTime2) {
      setErrorMessage("作業時間が誤っています確認して下さい。");
      return;
    }
    // 作業時間の長さチェック: 13時間以上ならエラー
    if (selectedTimes.time1 && selectedTimes.time2) {
      let time1Ms = selectedTimes.time1.getTime();
      let time2Ms = selectedTimes.time2.getTime();
      // 終了が開始より前なら日またぎ（例: 22:00〜2:00）とみなし、終了に24時間（ミリ秒）を足す
      if (time2Ms < time1Ms) {
        time2Ms += 24 * 60 * 60 * 1000;
      }
      // ミリ秒の差を時間に換算する（1時間 = 1000ミリ秒 × 60秒 × 60分）
      const diffInHours = (time2Ms - time1Ms) / (1000 * 60 * 60);
      if (diffInHours >= 13) {
        setErrorMessage("作業時間が13時間を越えています。確認してください。");
        return;
      }
    }
    // 作業時間の長さチェック（その2）: 開始 < 終了 で、時刻の差が21時間を超えていたらエラー
    // （直前の13時間チェックで既に弾かれるため、実際にこの条件に当てはまることはない）
    if (selectedTimes.time1 && selectedTimes.time2) {
      // 時刻を「0:00 からの経過分」に変換する（例: 8:30 → 510分）
      const time1Hours = selectedTimes.time1.getHours();
      const time1Minutes = selectedTimes.time1.getMinutes();
      const time2Hours = selectedTimes.time2.getHours();
      const time2Minutes = selectedTimes.time2.getMinutes();
      const time1InMinutes = time1Hours * 60 + time1Minutes;
      const time2InMinutes = time2Hours * 60 + time2Minutes;
      const timeDifference = Math.abs(time2InMinutes - time1InMinutes);
      const hoursDifference = timeDifference / 60;
      if ((time1InMinutes < time2InMinutes && hoursDifference > 21)) {
        setErrorMessage("作業時間が21時間を超えています。入力できません。");
        return;
      }
    }
    // 残業時間の単位チェック: 休出以外は15分単位でなければエラー
    if (data.work_time !== "休出" && overTime % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    // 休出の場合は5分単位でなければエラー（判定は5の倍数かどうかのみ）
    if (data.work_time === "休出" && overTime % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }
    // 作業詳細の文字数チェック: 100文字を超えたらエラー
    if (data.detail_work && data.detail_work.length > 100) {
      setErrorMessage("作業詳細は100文字以内にしてください。");
      return;
    }
    // 作業詳細に「$」があればエラー（サーバーでは作業詳細を「$」区切りで保存するため使えない）
    if (data.detail_work.includes("$")) {
      setErrorMessage("作業詳細に『$』は使用できません。");
      return;
    }

    // 送信データ: 入力値 + 作業時間（time1/time2）+ 休憩変更チェック（break_change）
    //   tomorrow_check は常に false（サーバーの工数入力処理では使われていない）
    const updatedData = {
      ...data,
      over_time: data.over_time || 0,
      time1: formattedTime1,
      time2: formattedTime2,
      tomorrow_check: false,
      break_change: isBreakChangeChecked,
    };

    try {
      // POST /api/kosu_new/ : 指定した時間帯に工数区分・作業詳細を書き込み、勤務・直・残業も更新する
      //   既に工数が入っている時間帯と重なる場合などはサーバーが400エラーを返す
      //   break_change が false のときは、休憩時間帯がサーバー側で休憩として書き込まれる
      await api.post("/api/kosu_new/", updatedData);
      setErrorMessage(null);
      // 成功メッセージを表示し、1秒（1000ミリ秒）後に消す
      setSuccessMessage("更新が成功しました！");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 1000);
      // 今回の作業時間を保存し、最新の工数データを取得し直す
      updateCachedTimes(selectedTimes.time1, selectedTimes.time2);
      fetchData();

      // 続けて入力しやすいよう、今回の終了時刻を次の開始時刻・終了時刻の初期値にする
      if (formattedTime2) {
        const workDay = new Date(data.work_day2);
        setSelectedTimes({
          time1: new Date(formattedTime2),
          time2: roundToNearestFiveMinutes(new Date(formattedTime2), workDay),
        });
        localStorage.setItem("time1", formattedTime2);
        localStorage.setItem("time2", formattedTime2);
      }

      // 入力欄（工数区分・作業詳細・残業時間など）を空に戻す
      setData({
        ...data,
        time_work: "",
        detail_work: "",
        over_time: 0,
        judgement: false,
        break_change: false,
      });
      setErrorMessage(null);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → 原因調査のため、遷移せずにエラーの詳細（ステータス・本文）を表示する
        else if (err.response?.status === 403) setErrorMessage(formatApiError(err));
        // その他（400: 入力エラー など）: サーバーのメッセージ、なければエラーの詳細を表示する
        else setErrorMessage(err.response?.data?.message || formatApiError(err));
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  /**
   * 「残業のみ登録」ボタン押下時の処理。残業時間の単位をチェックし、残業時間だけを登録する。
   *
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @returns なし
   */
  const handleSendOverTime = async () => {
    if (!data) return;

    const overTime = data.over_time || 0;

    // 残業時間の単位チェック: 休出以外は15分単位でなければエラー
    if (data.work_time !== "休出" && overTime % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    // 休出の場合は5分単位でなければエラー（判定は5の倍数かどうかのみ）
    if (data.work_time === "休出" && overTime % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }

    try {
      // POST /api/over_time/ : 就業日（work_day2）の工数データの残業時間（over_time）だけを更新
      //   工数データがない日は新規作成される
      await api.post("/api/over_time/", data);
      alert("残業情報を送信しました！");
      setErrorMessage(null);
      // 工数入力OK/NG判定の変化を反映するため取得し直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 就業日が未指定 など）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  /**
   * 残業時間の「+」（外側から2番目）ボタン: 指定項目の値を15増やす。
   *
   * @param field - 増やす項目名（この画面では "over_time"）
   * @returns なし（結果は data の state に反映）
   */
  const handleIncrement = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) + 15 });
    }
  };
  /**
   * 残業時間の「+」（一番外側）ボタン: 指定項目の値を1増やす。
   *
   * @param field - 増やす項目名（この画面では "over_time"）
   * @returns なし（結果は data の state に反映）
   */
  const handleIncrement2 = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) + 1 });
    }
  };
  /**
   * 残業時間の「-」（外側から2番目）ボタン: 指定項目の値を15減らす。
   *
   * @param field - 減らす項目名（この画面では "over_time"）
   * @returns なし（結果は data の state に反映）
   */
  const handleDecrement = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) - 15 });
    }
  };
  /**
   * 残業時間の「-」（一番外側）ボタン: 指定項目の値を1減らす。
   *
   * @param field - 減らす項目名（この画面では "over_time"）
   * @returns なし（結果は data の state に反映）
   */
  const handleDecrement2 = (field: keyof Kosu) => {
    if (data) {
      setData({ ...data, [field]: (data[field] as number || 0) - 1 });
    }
  };

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（fetchData は navigate が変わらない限り同じ関数のため実質1回）: 初期データを取得する
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 入力データが変わるたびに実行: 直または就業日が「前回から変わった」ときだけ、
  // 作業時間の開始・終了時刻を直ごとに決められた時刻に設定し直す
  // （前回値が null ＝ 初回のデータ取得時は変更とみなさない）
  useEffect(() => {
    const isTyokuChanged = prevTyokuRef.current !== null && data?.tyoku2 && data.tyoku2 !== prevTyokuRef.current;
    const isWorkDayChanged = prevWorkDayRef.current !== null && data?.work_day2 && data.work_day2 !== prevWorkDayRef.current;

    // 直か就業日が変わり、直が入力されている場合
    if ((isTyokuChanged || isWorkDayChanged) && data?.tyoku2) {
      const workDay = data ? new Date(data.work_day2) : new Date();
      let newTime = new Date(workDay);

      // 直（とショップ）ごとに時刻を決める
      //   組立系ショップ（W1/W2/A1/A2/J/組長以上(W,A)）は2直・3直の時刻が他ショップと異なる
      // 1直・連1直: 6:30
      if (data.tyoku2 === "1" || data.tyoku2 === "5") {
        newTime.setHours(6, 30, 0, 0);
      // 2直（組立系ショップ）: 11:10
      } else if (data.tyoku2 === "2" && (memberShop === "W1" || memberShop === "W2" || memberShop === "A1" || memberShop === "A2" || memberShop === "J" || memberShop === "組長以上(W,A)")) {
        newTime.setHours(11, 10, 0, 0);
      // 2直（それ以外のショップ）: 13:50
      } else if (data.tyoku2 === "2") {
        newTime.setHours(13, 50, 0, 0);
      // 3直（組立系ショップ）: 19:50
      } else if (data.tyoku2 === "3" && (memberShop === "W1" || memberShop === "W2" || memberShop === "A1" || memberShop === "A2" || memberShop === "J" || memberShop === "組長以上(W,A)")) {
        newTime.setHours(19, 50, 0, 0);
      // 3直（それ以外のショップ）: 22:25
      } else if (data.tyoku2 === "3") {
        newTime.setHours(22, 25, 0, 0);
      // 常昼: 8:00
      } else if (data.tyoku2 === "4") {
        newTime.setHours(8, 0, 0, 0);
      // 連2直: 17:10
      } else if (data.tyoku2 === "6") {
        newTime.setHours(17, 10, 0, 0);
      // 上記以外の直: 時刻は変えず、前回値だけ更新して終了する
      } else {
        prevTyokuRef.current = data.tyoku2;
        prevWorkDayRef.current = data.work_day2;
        return;
      }

      // 開始・終了時刻の両方を同じ時刻にし、localStorage にも保存する
      setSelectedTimes({
        time1: newTime,
        time2: newTime,
      });
      updateCachedTimes(newTime, newTime);
    }
    // 次回の比較のため、現在の直・就業日を前回値として覚えておく
    if (data?.tyoku2) {
      prevTyokuRef.current = data.tyoku2;
    }
    if (data?.work_day2) {
      prevWorkDayRef.current = data.work_day2;
    }
  }, [data?.tyoku2, memberShop, data?.work_day2, data]);

  // 作業詳細の選択肢: 工数区分を選んでいればその工数区分の作業詳細だけに絞り、未選択なら全件
  const filteredDetailList = data?.time_work 
    ? detailList.filter(item => item.def_symbol === data.time_work)
    : detailList;

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["kosu-new-wrapper"]}>
        {/* 画面タイトル（例: 山田太郎の工数入力） */}
        <h1 className={styles["h1-collar"]}>{memberName}の工数入力</h1>
        {/* ナビゲーション: 工数メニュー・メインメニューへのリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
          <Link to="/">メインMENU</Link>
          {/* その日の工数データがある（IDがある）場合だけ、工数編集画面へのリンクを表示 */}
          {data?.id && (
            <Link to={`/kosu-update/${data.id}`}>工数編集</Link>
          )}
        </nav>

        {/* 警告メッセージ（工数区分定義Verが最新でない場合など）があるときだけ表示 */}
        {warningMessage && (
          <div role="alert">{warningMessage}</div>
        )}

        {/* エラーメッセージがあるときだけ赤枠・赤字で表示 */}
        {/* whiteSpace: "pre-wrap" で改行をそのまま表示し（formatApiError の複数行表示用）、 */}
        {/* overflowWrap: "anywhere" で長い英数字も枠内で折り返す */}
        {errorMessage && (
          <div  
            role="alert"  
            style={{  
              whiteSpace: "pre-wrap",  
              overflowWrap: "anywhere",  
              color: "red",  
              border: "1px solid red",  
              padding: "8px",  
              marginBottom: "8px",  
            }}
          >  
            {errorMessage}  
          </div>
        )}

        {/* 登録成功メッセージ（表示から1秒後に消える） */}
        {successMessage && (
          <div className={styles["notice"]}>
            {successMessage}
          </div>
        )}

        {/* 工数の入力フォーム（送信で handleSubmit を実行） */}
        {/* onKeyDown: 入力欄で Enter を押してもフォーム送信せず、入力欄からフォーカスを外すだけにする */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // 入力欄（input要素）で Enter キーが押された場合、誤操作による登録を防ぐため送信を止め、
            // フォーカスを外して入力を確定させる
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            {/* 就業日の見出しと工数入力OK/NG判定（OKなら青、NGなら赤で表示） */}
            <label htmlFor="work_day2">就業日：
              <span style={{ 
                color: data?.judgement ? "blue" : "red", 
                marginLeft: "8px",
                fontSize: "1.2rem",
                fontWeight: "bold"
              }}>
                {data?.judgement ? "OK" : "NG"}
              </span>
            </label>
            {/* 就業日の入力欄（変更するとサーバーの就業日を切り替えてデータを取得し直す） */}
            <input
              type="date"
              id="work_day2"
              name="work_day2"
              value={data?.work_day2 || ""}
              onChange={handleChange}
            />

            {/* 勤務・直の選択欄（勤務は mode='LIMIT': 休日・年休など終日休みの勤務を除いた選択肢にする） */}
            <label htmlFor="work_time">勤務・直：</label>
            <div className={styles["work-tyoku-wrapper"]}>
              <WorkSelect id="work_time" value={data?.work_time || ""} onChange={handleChange} mode='LIMIT' />
              <TyokuSelect id="tyoku2" value={data?.tyoku2 || ""} onChange={handleChange} />
            </div>

            {/* 作業内容（工数区分）の見出しと、工数区分定義の確認画面へのリンク */}
            <label htmlFor="time_work">
              作業内容：
              <Link to="/def-search" className={`green_button ${styles["font-min"]}`}>
                工数区分定義確認
              </Link>
            </label>
            {/* 工数区分の選択欄（選択肢は工数区分定義から作られる） */}
            <DefSelect id="time_work" value={data?.time_work || ""} onChange={handleChange} defData={defData} />

            {/* 作業詳細の見出しと「手入力」チェックボックス（チェックすると自由入力欄に切り替わる） */}
            <label htmlFor="detail_work">
              作業詳細：
              <span>
                手入力：
                <input 
                  type="checkbox" 
                  checked={isDetailSelectMode} 
                  onChange={(e) => setIsDetailSelectMode(e.target.checked)} 
                />
              </span>
            </label>
            
            {/* 作業詳細の入力欄: 手入力モードなら文字入力欄、そうでなければ選択肢のプルダウンを表示 */}
            {isDetailSelectMode ? (
              <input
                type="text"
                id="detail_work"
                name="detail_work"
                value={data?.detail_work || ""}
                onChange={handleChange}
              />
            ) : (
              <select
                id="detail_work"
                name="detail_work"
                value={data?.detail_work || ""}
                onChange={handleChange}
              >
                <option value="">-- 作業詳細を選択 --</option>
                {/* 作業詳細の選択肢（工数区分で絞り込み済み）を1件ずつ表示（key には並び順の番号を使う） */}
                {filteredDetailList.map((item, index) => (
                  <option key={index} value={item.def_select}>
                    {item.def_select}
                  </option>
                ))}
              </select>
            )}

            {/* 作業時間の見出しと「現在時刻」ボタン（終了時刻を現在時刻にする） */}
            <label>
              作業時間：
              <button type="button" onClick={setTime2ToCurrentRounded} className={`light_blue_button ${styles["font-min"]}`}>
                現在時刻
              </button>
            </label>
            {/* 開始時刻 〜 終了時刻 の時刻選択欄 */}
            <div className={styles["time-picker-wrapper"]}>
              {/* 開始時刻の選択欄: 24時間表記・5分刻み */}
              {/* onAccept: 時刻を確定してダイアログが閉じたとき、MUIのダイアログ表示中に root 要素へ付く */}
              {/*           aria-hidden 属性（読み上げ対象外にする印）を取り除き、画面が操作対象に戻るようにする */}
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={selectedTimes.time1}
                  onChange={(newTime) => handleTimeChange("time1", newTime)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
              {/* 開始と終了の区切り文字 */}
              <span>〜</span>
              {/* 終了時刻の選択欄: 開始時刻と同じ設定 */}
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={selectedTimes.time2}
                  onChange={(newTime) => handleTimeChange("time2", newTime)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>

            {/* 残業時間の見出しと「残業のみ登録」ボタン（作業時間を入れずに残業時間だけ登録する） */}
            <label htmlFor="over_time">
              残業時間：
              <button
                type="button"
                onClick={handleSendOverTime}
                className={`light_blue_button ${styles["font-min"]}`}
              >
                残業のみ登録
              </button>
            </label>
            {/* 残業時間（分）の入力欄と増減ボタン: 外側のボタン（custom-button2）は ±1分、内側（custom-button）は ±15分 */}
            <div className={styles["over-time-wrapper"]}>
              {/* 1分減らす */}
              <button
                type="button"
                className={styles["custom-button2"]}
                onClick={() => handleDecrement2("over_time")}
              >
                -
              </button>
              {/* 15分減らす */}
              <button
                type="button"
                className={styles["custom-button"]}
                onClick={() => handleDecrement("over_time")}
              >
                -
              </button>
              {/* 残業時間（分）の直接入力欄 */}
              <input
                type="number"
                id="over_time"
                name="over_time"
                value={data?.over_time || 0}
                onChange={handleChange}
              />
              {/* 15分増やす */}
              <button
                type="button"
                className={styles["custom-button"]}
                onClick={() => handleIncrement("over_time")}
              >
                +
              </button>
              {/* 1分増やす */}
              <button
                type="button"
                className={styles["custom-button2"]}
                onClick={() => handleIncrement2("over_time")}
              >
                +
              </button>
            </div>

            {/* 「休憩時間工数入力可」スイッチ: ON にすると、登録時に休憩時間帯を休憩で上書きしない */}
            {/* （休憩時間帯にも工数を入力できる）。見出しには当日休憩時間変更画面へのリンクを置く */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="break_change">休憩時間工数入力可：
                <Link to="/today-break-time" className={`light_blue_button ${styles["font-min"]}`}>
                  休憩変更登録
                </Link>
              </label>
              {/* スイッチ本体: 枠をクリックしてもチェックボックスを直接操作しても ON/OFF が切り替わる */}
              <div
                className={styles["toggle-switch"]}
                onClick={() => setIsBreakChangeChecked(!isBreakChangeChecked)}
              >
                <input
                  type="checkbox"
                  id="break_change"
                  name="break_change"
                  checked={isBreakChangeChecked}
                  onChange={(e) => setIsBreakChangeChecked(e.target.checked)}
                />
                {/* スイッチのつまみ部分の見た目 */}
                <span className={styles["toggle-slider"]}></span>
              </div>
            </div>

            {/* 更新ボタン（フォームを送信し handleSubmit を実行） */}
            <button type="submit" className="light_blue_button">更新</button>
          </div>
        </form>
        {/* 登録済みの作業内容がある場合だけ、時間帯別の一覧表・時刻ごとのグラフ・工数区分の凡例を表示 */}
        {/* 直とショップを渡すのは、勤務時間帯に合わせて表示範囲を切り替えるため。勤務は基準合計工数の表示に使われる */}
        {initialTimeWork && (
          <div className={styles["centeredContainer"]}>
            <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""} defData={defData} tyoku={initialTyoku || ""} shop={memberShop || ""} work={data?.work_time || ""} headerColor="#0ff" />
            <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
            <DefTable defData={defData} />
          </div>
        )}
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuNew;