/**
 * ============================================================
 * ファイル名 : KosuEdit.tsx
 * 種別       : 画面コンポーネント（工数データ編集画面）
 * 概要       : 工数履歴一覧の「編集」リンク（または工数入力画面の「工数編集」リンク）から開く画面。
 *              URLのIDで指定された1日分の工数データを「作業時間帯ごとの行」に分解して表示し、
 *              行単位の修正・追加・削除や、勤務・直・残業時間・就業日の変更を行う。
 *
 * 主な機能   :
 *   - 作業内容・作業詳細の文字列を「開始〜終了時刻・工数区分・作業詳細」の行に分解して表示
 *   - 行ごとの編集（スイッチで編集可能にしてから変更）・行の追加/削除と一括更新
 *   - 1行分の時間帯の工数だけをすぐに削除
 *   - 勤務・直・残業時間の変更（スイッチで編集可能にしてから変更）
 *   - 就業日の変更（「就業日更新」ボタン）
 *   - 作業内容のグラフと工数区分の凡例の表示
 *
 * 使用API    : GET  /api/kosu_update/<id>/  編集対象の工数データ取得（kosu/views/kosu_views.py の KosuUpdate）
 *              PUT  /api/kosu_update/<id>/  工数データの一括更新（同上）
 *              POST /api/item_delete/       1行分の時間帯の工数を削除（同 ItemDlete）
 *              PUT  /api/day_update/        就業日の変更（同 DayUpdate）
 * 画面URL    : /kosu-update/:id             （index.tsx のルーティング定義。:id は工数データのID）
 * 関連ファイル: styles/KosuPage/KosuEdit.module.css, Components/Loading.tsx,
 *              Components/TyokuSelect.tsx, Components/WorkSelect.tsx, Components/DefSelect.tsx,
 *              Components/KosuBarChart.tsx, Components/DefTable.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, FormEvent, ChangeEvent, useCallback, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import TyokuSelect from "../Components/TyokuSelect"; // 直の選択欄
import WorkSelect from "../Components/WorkSelect"; // 勤務（就業形態）の選択欄
import DefSelect from "../Components/DefSelect"; // 工数区分の選択欄
import KosuBarChart from "../Components/KosuBarChart"; // 作業内容を時刻ごとに色分けして表示するグラフ
import DefTable from "../Components/DefTable"; // 工数区分名と色の対応表（グラフの凡例）
import Loading from "../Components/Loading"; // 読み込み中の表示
import { LocalizationProvider } from "@mui/x-date-pickers"; // 時刻選択欄に日付ライブラリを渡す外枠（MUI部品）
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"; // 日付ライブラリ date-fns を MUI の時刻選択欄で使うためのアダプター
import { MobileTimePicker } from "@mui/x-date-pickers"; // ダイアログ形式の時刻選択欄（MUI部品）
import styles from "../styles/KosuPage/KosuEdit.module.css";

// ============================================================
// 型定義
// ============================================================

/**
 * 編集対象の工数データ（GET /api/kosu_update/<id>/ のレスポンス kosu_data）兼 勤務・直・残業などの入力値。
 *
 * 型には書かれていないが、レスポンスには id（工数データのID）も含まれており、就業日更新で使われる。
 */
interface Kosu {
  employee_no3: number; // 従業員番号
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"）
  time_work: string; // 作業内容（5分ごとの工数区分記号を288文字並べた文字列。"#"=未入力、"$"=休憩）
  detail_work: string; // 作業詳細（5分ごとの作業詳細を "$" 区切りで並べた文字列）
  over_time: number; // 残業時間（分）
  work_time: string; // 就業形態（出勤・休日・年休 など）
  def_ver2: string; // この工数データの入力に使った工数区分定義Ver
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
  break_change: boolean; // 休憩変更チェック（工数入力時に休憩時間を自動で書き込まないようにしたか）
}

/** 工数区分定義（レスポンス def_data）。キーは kosu_title_1 などの項目名 */
interface DefData {
  [key: string]: string | undefined; // 項目名 → 値（例: kosu_title_1 → 工数区分名）
}

/** ログイン者の人員データのうち、この画面で使う項目（レスポンス member_data） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）。直と合わせて行の表示時間帯の決定に使う
}

/** 作業詳細の選択肢1件分（レスポンス detail_data_list の要素） */
interface DetailData {
  def_symbol: string; // この作業詳細が属する工数区分の記号（"A"〜"x"、"$"=休憩）
  def_select: string; // 作業詳細の文言
}

/** GET /api/kosu_update/<id>/ のレスポンス全体 */
interface KosuResponse {
  kosu_data: Kosu; // 編集対象の工数データ
  def_data: DefData; // 工数データの工数区分定義Ver（未設定ならセッションの定義Ver）の工数区分定義
  member_data: Member; // ログイン者の人員データ
  detail_data_list: DetailData[]; // 作業詳細の選択肢（全工数区分分）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数データ編集画面。
 *
 * 表示時にURLのIDで工数データを取得し、作業内容を「開始〜終了時刻・工数区分・作業詳細」の行に分解する。
 * 各行は最初はロック（編集不可）されており、行頭のスイッチを ON にすると編集できる。
 * 「更新」ボタンで全行の内容をサーバーへ送り、作業内容を作り直す。
 *
 * @returns 工数データ編集画面のJSX
 */
const KosuEdit: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<Kosu | null>(null); // 工数データ兼 就業日・勤務・直・残業の入力値（null なら未取得）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // 通信エラーのメッセージ（あると画面全体をエラー表示に切り替える）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 入力チェックのエラーメッセージ（フォームの上に表示）
  const { id } = useParams<{ id: string }>(); // URL（/kosu-update/:id）に含まれる工数データのID
  const [defData, setDefData] = useState<DefData>({}); // 工数区分定義（工数区分の選択肢・表示名に使う）
  const [memberShop, setMemberShop] = useState<string>(""); // ログイン者のショップ（行の表示時間帯・グラフの決定に使う）
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null); // 取得時点の作業内容（グラフ表示用）
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null); // 取得時点の直（グラフの表示時間帯の決定に使う）
  // 作業時間帯ごとの行データ（画面の1行 = 配列の1要素）
  //   time1: 開始時刻 / time2: 終了時刻 / work: 工数区分の記号（"$"=休憩） / detail: 作業詳細
  const [timeData, setTimeData] = useState<{
    time1: Date | null;
    time2: Date | null;
    work: string;
    detail: string;
  }[]>([]);
  const [isDisabled, setIsDisabled] = useState<boolean[]>([]); // 行ごとのロック状態（true: 編集不可）。インデックスは timeData と対応
  const [isWorkTyokuDisabled, setIsWorkTyokuDisabled] = useState<boolean>(true); // 勤務・直・残業欄のロック状態（true: 編集不可）

  const [isDetailTextMode, setIsDetailTextMode] = useState<boolean[]>([]); // 行ごとの作業詳細の入力方法（true: 手入力 / false: 選択肢から選ぶ）
  const [detailDataList, setDetailDataList] = useState<DetailData[]>([]); // 作業詳細の選択肢リスト（全工数区分分）

  // 作業内容を行データに分解（パース）済みかどうか
  // 入力中に formData が変わるたびに分解し直して編集内容が消えないよう、1回だけ分解するための目印。
  // 値が変わっても再描画は不要なので、state ではなく ref で保持する
  const isParsedRef = useRef(false);

  // ---------- データ取得 ----------

  /**
   * 編集対象の工数データ・工数区分定義・作業詳細の選択肢を取得し、state に保存する。
   *
   * 取得後は分解済みフラグを戻し、下の useEffect で作業内容を行データに分解し直させる。
   * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * useEffect の依存配列や他の処理から呼ぶため、useCallback で関数を使い回す。
   *
   * @returns なし（結果は formData / defData / detailDataList などの state に反映）
   */
  const fetchData = useCallback(async () => {
    try {
      // GET /api/kosu_update/<id>/ : 工数データ・工数区分定義・人員データ・作業詳細の選択肢を取得
      //   サーバーはこの工数データの就業日をセッションの就業日として保存する
      const response = await api.get<KosuResponse>(`/api/kosu_update/${id}/`);
      const { kosu_data, def_data, member_data, detail_data_list } = response.data;
      setFormData(kosu_data);
      setDefData(def_data);
      setMemberShop(member_data.shop);
      setInitialTimeWork(kosu_data.time_work);
      setInitialTyoku(kosu_data.tyoku2);
      setDetailDataList(detail_data_list || []);
      // データを再取得した際はパースを許可する
      isParsedRef.current = false;
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または工数区分定義Verが未選択・見つからない → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404: 工数データなし など）: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [id, navigate]);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLのIDが変わったとき: 工数データを取得する
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 工数データ・工数区分定義・ショップ・作業詳細の選択肢が変わったとき:
  // 作業内容・作業詳細の文字列を行データ（timeData）に分解する（データ再取得後の1回だけ）
  useEffect(() => {
    // 工数データ・工数区分定義が揃っていない、または分解済みなら何もしない
    if (!formData || Object.keys(defData).length === 0 || isParsedRef.current) {
      return;
    }

    const { time_work, detail_work, tyoku2 } = formData;
    const timeWork = time_work;
    const workDetail = detail_work;
    const tyoku = tyoku2;

    /**
     * 作業内容・作業詳細の文字列を、工数区分と作業詳細が同じ区間ごとにまとめた行の配列にする。
     *
     * 作業内容は1文字が5分を表す288文字（インデックス i が 0:00 から i×5 分後に対応）。
     * 日をまたぐ直でも区間が0:00で途切れないよう、直ごとに決めた位置から24時間分を切り出して処理する
     * （Components/KosuDisplay.tsx と同じ考え方。ただし2直・3直の切り出し位置の数値は一部異なる）。
     *
     * @returns 行の配列（time1/time2: "HH:MM"、work: 工数区分名（"休憩" 含む）、detail: 作業詳細）
     */
    const parseTimeWorkAndDetail = () => {
      // 工数区分記号 → 工数区分名 の対応表（kosu_title_1 → "A"、kosu_title_2 → "B" … の順に割り当てる）
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .reduce((acc, key, index) => {
          acc["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"[index]] = defData[key] ?? null;
          return acc;
        }, {} as Record<string, string | null>);

      // 文字列を2日分つなげ（576文字）、先頭 start 文字と末尾 end 文字を除いて24時間分（288文字）を切り出す
      // 例: start=54 → 54×5分 = 4:30 から翌日4:30 までの並びになる（start + end は常に288）
      const adjustRange = (start: number, end: number) => ({
        adjustedTimeWork: timeWork.repeat(2).slice(start, timeWork.length * 2 - end),
        splitDetails: workDetail.split("$").concat(workDetail.split("$")).slice(start, workDetail.split("$").length * 2 - end)
      });

      // 直ごとの切り出し位置（start: 開始インデックス。例: 54 = 4:30、242 = 20:10）
      //   "2W_A" / "3W_A" は組立系ショップ（W1/W2/A1/A2/J/組長以上(W,A)）の2直・3直用
      //   ここにない直（連1直 "5" など）は切り出さず、0:00〜24:00 のまま処理する
      const ranges: Record<string, { start: number; end: number }> = {
        "1": { start: 54, end: 234 },
        "2W_A": { start: 106, end: 182 },
        "2": { start: 140, end: 148 },
        "3W_A": { start: 214, end: 74 },
        "3": { start: 242, end: 46 },
        "4": { start: 72, end: 216 },
        "6": { start: 182, end: 106 },
      };
      // 切り出し位置のキー: 直の番号。2直・3直かつ組立系ショップなら末尾に "W_A" を付ける
      const rangeKey = tyoku + ((tyoku === "2" || tyoku === "3") && (["W1", "W2", "A1", "A2", "J", "組長以上(W,A)"].includes(memberShop)) ? "W_A" : "");

      // 切り出し位置が定義されていれば切り出し、なければ元の文字列をそのまま使う
      const { adjustedTimeWork, splitDetails } = ranges[rangeKey]
        ? adjustRange(ranges[rangeKey].start, ranges[rangeKey].end)
        : { adjustedTimeWork: timeWork, splitDetails: workDetail.split("$") };

      // 分解結果と、処理中の区間の状態（工数区分名・作業詳細・開始インデックス。-1 は区間外）
      const result: { time1: string; time2: string; work: string; detail: string }[] = [];
      let currentWork = "", currentDetail = "", startIndex = -1;

      // 処理中の区間を1行として確定する（区間がなければ何もしない）
      //   i: 区間の終わり（このインデックスの手前まで）/ offset: 切り出し位置（時刻計算で元の位置に戻すため加算）
      const pushResult = (i: number, offset: number) => {
        if (currentWork || currentDetail) {
          // インデックス → 時刻（12マスで1時間、1マス5分。24時以降は % 24 で翌日の時刻に戻す）
          const startHour = Math.floor((startIndex + offset) / 12) % 24;
          const startMinute = ((startIndex + offset) % 12) * 5;
          const endHour = Math.floor((i + offset) / 12) % 24;
          const endMinute = ((i + offset) % 12) * 5;
          // "HH:MM" 形式にする（例: 8:05 → "08:05"）
          const timeRange1 = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
          const timeRange2 = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
          result.push({ time1: timeRange1, time2: timeRange2, work: currentWork, detail: currentDetail });
        }
      };

      // 1文字（5分）ずつ調べる。最後に i = 文字数（範囲外）まで回し、最後の区間も確定させる
      for (let i = 0; i <= adjustedTimeWork.length; i++) {
        const charWork = adjustedTimeWork[i];
        // 記号を工数区分名に変換する（"$" は休憩）
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork];
        // 同じ位置の作業詳細（作業内容と作業詳細の要素数が同じなら i 番目）
        const charDetail = splitDetails[Math.floor(i / (adjustedTimeWork.length / splitDetails.length))] ?? "";

        // 未入力（"#"）または文字列の終わり: 処理中の区間を確定し、区間外の状態に戻す
        if (charWork === "#" || charWork === undefined) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        // 工数区分か作業詳細が変わった: 前の区間を確定し、ここから新しい区間を始める
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          // 工数区分名が見つからない記号は、記号そのものを工数区分名として扱う
          currentWork = mappedWork || charWork;
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      return result;
    };

    const parsedResults = parseTimeWorkAndDetail();

    // 分解した行を画面用の行データに変換する
    //   工数区分名 → 記号（工数区分の選択欄の値）、"HH:MM" → Date（時刻選択欄の値）
    const newTimeData = parsedResults.map((item) => {
      // 工数区分の選択肢を Components/DefSelect.tsx と同じ方法で作り、名称が一致する選択肢の記号を探す
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";
      const defOptions = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .map((key, index) => ({
          value: alphabet[index],
          label: defData[key] || "",
        }))
        .filter(({ label }) => label !== "");
      defOptions.push({ value: "$", label: "休憩" });
      const matchedOption = defOptions.find((option) => option.label === item.work);
      // 一致する工数区分がなければ未選択（空文字）にする
      const workValue = matchedOption ? matchedOption.value : "";

      // 時刻を今日の日付の Date にする（時刻選択欄では時刻しか使わないため、日付は今日でよい）
      const baseDate = new Date();
      const [startHour, startMinute] = item.time1.split(":").map(Number);
      const [endHour, endMinute] = item.time2.split(":").map(Number);

      const time1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMinute);
      const time2 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute);

      return {
        time1: time1,
        time2: time2,
        work: workValue,
        detail: item.detail,
      };
    });

    // 行ごとの作業詳細の入力方法の初期値を決める
    //   作業詳細が空・休憩の行 → 選択肢モード / 作業詳細が選択肢にない文言 → 手入力モード
    const initialDetailMode = newTimeData.map((item) => {
      if (!item.detail) return false;
      if (item.work === "$") return false;
      
      const existsInList = detailDataList.some(d => d.def_select === item.detail);
      return !existsInList;
    });

    // 行データを保存し、全行を最初はロック（編集不可）にする
    setTimeData(newTimeData);
    setIsDisabled(newTimeData.map(() => true));
    setIsDetailTextMode(initialDetailMode);

    // 分解済みにする（次にデータを再取得するまで分解し直さない）
    isParsedRef.current = true;
  }, [formData, defData, memberShop, detailDataList]);

  // ---------- イベントハンドラ ----------

  /**
   * 入力欄の変更時の共通処理。行の入力欄なら timeData、それ以外なら formData を書き換える。
   *
   * @param event - 入力欄の変更イベント（行以外の欄では name 属性で項目を判別する）
   * @param index - 行の入力欄の場合の行番号（0始まり）。省略時は行以外の欄とみなす
   * @param field - 行の入力欄の場合に書き換える項目名（例: "detail"）
   * @returns なし（結果は timeData または formData の state に反映）
   */
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    index?: number,
    field?: string
  ) => {
    const { name, value } = event.target;

    if (!formData) return;

    // 行の入力欄（行番号と項目名が渡された場合）: 該当行の該当項目だけを書き換える
    if (index !== undefined && field) {
      setTimeData((prevTimeData) => {
        const updatedTimeData = [...prevTimeData];
        updatedTimeData[index] = {
          ...updatedTimeData[index],
          [field]: value,
        };
        return updatedTimeData;
      });
    // 行以外の欄（就業日・勤務・直・残業時間）: name 属性と同じ名前の項目を書き換える
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  /**
   * 行の工数区分を変えたときの処理。
   *
   * 作業詳細が選択肢モードの行では、作業詳細をその工数区分の最初の選択肢に自動で切り替える
   * （該当する選択肢がなければ空にする）。
   *
   * @param e     - 工数区分の選択欄の変更イベント
   * @param index - 行番号（0始まり）
   * @returns なし（結果は timeData の state に反映）
   */
  const handleWorkChange = (e: ChangeEvent<HTMLSelectElement>, index: number) => {
    const selectedWork = e.target.value;
    setTimeData((prev) => {
      // 配列はコピーするが、行のオブジェクト自体は元のものを直接書き換えている
      const updated = [...prev];
      updated[index].work = selectedWork;
      // 選択肢モードの行: 作業詳細をその工数区分の最初の選択肢にする
      if (!isDetailTextMode[index]) {
        const firstDetail = detailDataList.find(d => d.def_symbol === selectedWork);
        updated[index].detail = firstDetail ? firstDetail.def_select : "";
      }
      return updated;
    });
  };

  /**
   * 行の作業詳細を選択肢から選んだときの処理。その作業詳細が属する工数区分を自動で選ぶ。
   *
   * @param e     - 作業詳細の選択欄の変更イベント
   * @param index - 行番号（0始まり）
   * @returns なし（結果は timeData の state に反映）
   */
  const handleDetailChange = (e: ChangeEvent<HTMLSelectElement>, index: number) => {
    const selectedDetail = e.target.value;
    setTimeData((prev) => {
      // 配列はコピーするが、行のオブジェクト自体は元のものを直接書き換えている
      const updated = [...prev];
      updated[index].detail = selectedDetail;
      // 選んだ作業詳細の工数区分が分かれば、行の工数区分もそれに合わせる
      const matchedWork = detailDataList.find(d => d.def_select === selectedDetail);
      if (matchedWork) {
        updated[index].work = matchedWork.def_symbol;
      }
      return updated;
    });
  };

  /**
   * 行の時刻選択欄が変わったとき、その行の開始または終了時刻を更新する。
   *
   * @param field   - 更新する項目（"time1": 開始時刻 / "time2": 終了時刻）
   * @param newTime - 選択された時刻
   * @param index   - 行番号（0始まり）
   * @returns なし（結果は timeData の state に反映）
   */
  const handleTimeChange = (
    field: "time1" | "time2",
    newTime: Date | null,
    index: number
  ) => {
    // 存在しない行番号なら開発者向けにエラーを出力して何もしない
    if (!timeData[index]) {
      console.error(`Index ${index} is out of bounds or undefined in timeData.`);
      return;
    }

    // 配列をコピーして該当行の時刻を書き換える（行のオブジェクト自体は直接書き換えている）
    const updatedTimeData = [...timeData];
    updatedTimeData[index][field] = newTime;
    setTimeData(updatedTimeData);
  };

  /**
   * 行頭のスイッチ操作時に、その行のロック（編集不可）を切り替える。
   *
   * @param index - 行番号（0始まり）
   * @returns なし（結果は isDisabled の state に反映）
   */
  const handleCheckboxChange = (index: number) => {
    setIsDisabled((prevIsDisabled) => {
      const updatedDisabled = [...prevIsDisabled];
      updatedDisabled[index] = !updatedDisabled[index];
      return updatedDisabled;
    });
  };

  /**
   * 勤務・直・残業欄のスイッチ操作時に、ロック（編集不可）を切り替える。
   *
   * @returns なし（結果は isWorkTyokuDisabled の state に反映）
   */
  const handleWorkTyokuCheckboxChange = () => {
    setIsWorkTyokuDisabled((prev) => !prev);
  };

  /**
   * 作業詳細の前のスイッチ操作時に、その行の作業詳細の入力方法（手入力 / 選択肢）を切り替える。
   *
   * @param index - 行番号（0始まり）
   * @returns なし（結果は isDetailTextMode の state に反映）
   */
  const handleDetailModeChange = (index: number) => {
    setIsDetailTextMode((prev) => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  /**
   * 「更新」ボタン押下時の処理。入力内容をチェックし、全行の内容で工数データを更新する。
   *
   * サーバー側では送られた行だけから作業内容を作り直す（画面に残っていない時間帯の工数は消える）。
   * チェック内容（引っかかったらエラーを表示して送信しない）:
   *   - 休憩以外の行で、工数区分と作業詳細の片方だけが入力されていない
   *   - 勤務・直が入力されている
   *   - 時刻（開始・終了）が未入力の行がある
   *   - 残業時間の単位（休出以外は15分単位、休出は5分単位）
   *   - 作業詳細が100文字を超える行・「$」を含む行がある（行の値は timeData から調べる）
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止める
    event.preventDefault();

    // 工数区分と作業詳細の片方だけが入力された行があるか調べる（休憩の行は作業詳細なしでよいので対象外）
    const isInvalidPair = timeData.some((item) => {
      const hasWork = !!item.work;
      const hasDetail = !!item.detail;
      if (item.work === "$") {
        return false; 
      }
      return (hasWork && !hasDetail) || (!hasWork && hasDetail);
    });

    if (isInvalidPair) {
      setErrorMessage("作業内容と作業詳細はセットで入力してください。");
      return;
    }

    // 行データを送信用の項目に展開する（N は1始まりの行番号）
    //   time1_N / time2_N: 開始・終了時刻（UTC の日時文字列。サーバーで日本時間の時・分に戻される）
    //   timeData_work_N  : 工数区分の記号 / timeData_detail_N: 作業詳細
    const submittedData = timeData.reduce((acc, item, index) => {
      acc[`time1_${index + 1}`] = item.time1?.toISOString() || "";
      acc[`time2_${index + 1}`] = item.time2?.toISOString() || "";
      acc[`timeData_work_${index + 1}`] = item.work;
      acc[`timeData_detail_${index + 1}`] = item.detail || "";
      return acc;
    }, {} as Record<string, string>);

    if (!formData) return;

    // 送信データ: 工数データ（就業日・勤務・直・残業など）+ 行データ
    const updatedFormData = {
      ...formData,
      ...submittedData,
    };
    // 必須項目チェック: 勤務・直のどちらかが空ならエラー
    if (!formData.work_time || !formData.tyoku2) {
      setErrorMessage("入力必要項目が入力されていません。");
      return;
    }
    // 時刻の未入力チェック: 開始時刻（time1）・終了時刻（time2）のどちらかが空の行があればエラー
    //   （時刻選択欄で時刻を消すと null になる）
    if (timeData.some((item) => !item.time1 || !item.time2)) {
      setErrorMessage("すべての作業時間を入力してください。");
      return;
    }
    // 残業時間の単位チェック: 休出以外は15分単位でなければエラー
    if (formData.work_time !== "休出" && formData.over_time % 15 !== 0) {
      setErrorMessage("残業の最小単位は15分です。確認してください。");
      return;
    }
    // 休出の場合は5分単位でなければエラー（判定は5の倍数かどうかのみ）
    if (formData.work_time === "休出" && formData.over_time % 5 !== 0) {
      setErrorMessage("休出時の残業は(15n+5)分です。確認してください。");
      return;
    }
    // 作業詳細の文字数チェック: 作業詳細が100文字を超える行があればエラー
    if (timeData.some((item) => (item.detail || "").length > 100)) {
      setErrorMessage("作業詳細は100文字以内にしてください。");
      return;
    }
    // 作業詳細の「$」チェック: 作業詳細に「$」を含む行があればエラー
    //   （サーバーでは作業詳細を「$」区切りの1つの文字列にして保存するため、「$」は使えない）
    if (timeData.some((item) => (item.detail || "").includes("$"))) {
      setErrorMessage("作業詳細に『$』は使用できません。");
      return;
    }

    try {
      // PUT /api/kosu_update/<id>/ : 行データから作業内容・作業詳細を作り直し、勤務・直・判定を更新
      //   行同士の時間帯が重なる場合、就業日を書き換えていた場合（就業日更新を使う必要がある）、
      //   工数区分定義Verが違う場合はサーバーが400エラーを返す
      await api.put(`/api/kosu_update/${id}/`, updatedFormData);
      alert("データが更新されました！");
      // 更新後のデータを取得し直して行を作り直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 入力エラー・404: 本人以外のデータ など）: サーバーのメッセージを画面全体に表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  /**
   * 残業時間の「+」ボタン: 指定項目の値を15増やす。
   *
   * @param field - 増やす項目名（この画面では "over_time"）
   * @returns なし（結果は formData の state に反映）
   */
  const handleIncrement = (field: keyof Kosu) => {
    if (formData) {
      // 入力欄の値は文字列になっている場合があるため、数値に変換してから足す
      const currentValue = Number(formData[field]) || 0;
      setFormData({
        ...formData,
        [field]: currentValue + 15,
      });
    }
  };

  /**
   * 残業時間の「-」ボタン: 指定項目の値を15減らす。
   *
   * @param field - 減らす項目名（この画面では "over_time"）
   * @returns なし（結果は formData の state に反映）
   */
  const handleDecrement = (field: keyof Kosu) => {
    if (formData) {
      // 入力欄の値は文字列になっている場合があるため、数値に変換してから引く
      const currentValue = Number(formData[field]) || 0;
      setFormData({
        ...formData,
        [field]: currentValue - 15,
      });
    }
  };

  /**
   * 行の「削除」ボタン押下時の処理。その行の時間帯の工数をサーバー上ですぐに削除する。
   *
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @param index - 削除する行番号（0始まり）
   * @returns なし
   */
  const handleDeleteItem = async (index: number) => {
    if (!formData) return;
    const itemToDelete = timeData[index];

    // 存在しない行番号なら開発者向けにエラーを出力して何もしない
    if (!itemToDelete) {
      console.error(`Index ${index} is out of bounds for deletion.`);
      return;
    }

    // 送信データ: 行番号・行データ（time1/time2/work/detail）・就業日
    //   time1/time2 の Date は送信時に UTC の日時文字列へ自動変換される
    const requestData = {
      index,
      ...itemToDelete,
      work_day2: formData.work_day2, 
    };

    try {
      // POST /api/item_delete/ : 就業日の工数データから、time1〜time2 の時間帯の作業内容・作業詳細を消す
      await api.post(`/api/item_delete/`, requestData);
      alert(`行 ${index + 1} が削除されました！`);
      // 削除後のデータを取得し直して行を作り直す
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または対象の工数データが見つからない → ログイン画面へ
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
   * 「就業日更新」ボタン押下時の処理。この工数データの就業日を、日付欄で選んだ日に変更する。
   *
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @returns なし
   */
  const handleSendDayUpdate = async () => {
    if (!formData) return;

    try {
      // PUT /api/day_update/ : formData の id の工数データの就業日を work_day2 に変更
      //   変更先の日に既に工数データがある場合はサーバーが400エラーを返す
      await api.put(`/api/day_update/`, formData);
      alert("日付編集を送信しました！");
      fetchData();
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 就業日未指定・変更先にデータあり など）: サーバーのメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  /**
   * 「行追加」ボタン押下時の処理。末尾に空の行（0:00〜0:00、工数区分・作業詳細なし）を追加する。
   *
   * 追加した行は最初から編集可能・作業詳細は選択肢モードにする（画面上の追加のみで、保存は「更新」時）。
   *
   * @returns なし（結果は timeData / isDisabled / isDetailTextMode の state に反映）
   */
  const addEmptyForm = () => {
    // 今日の日付の 0:00 を開始・終了時刻の初期値にする
    const baseDate = new Date()
    const time1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0);
    const time2 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0);

    setTimeData((prevTimeData) => [
      ...prevTimeData,
      {
        time1: time1,
        time2: time2,
        work: '',
        detail: '',
      }
    ]);
    setIsDisabled((prevIsDisabled) => [...prevIsDisabled, false]); // 追加時は入力可能にする
    setIsDetailTextMode((prev) => [...prev, false]); // 作業詳細は選択肢モードで始める
  };

  /**
   * 「行削除」ボタン押下時の処理。末尾の行を画面から取り除く（保存は「更新」時）。
   *
   * @returns なし（結果は timeData / isDisabled / isDetailTextMode の state に反映）
   */
  const removeLastForm = () => {
    // 行が1つもなければ何もしない
    if (timeData.length > 0) {
      // 行データ・ロック状態・入力方法の各配列から、末尾の要素を取り除く
      setTimeData((prevTimeData) => {
        const updatedTimeData = [...prevTimeData];
        updatedTimeData.pop();
        return updatedTimeData;
      });
      setIsDisabled((prevIsDisabled) => prevIsDisabled.slice(0, -1));
      setIsDetailTextMode((prev) => prev.slice(0, -1));
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // 通信エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 工数データが取得できなかった場合はその旨だけを出す
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      <div className={styles["kosu-edit-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数データ編集</h1>
        {/* 工数履歴一覧画面・工数入力画面へのリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-list">工数履歴</Link>
          <Link to="/kosu-new">工数入力</Link>
        </nav>

        {/* 入力チェックのエラーメッセージがあるときだけ赤字で表示 */}
        {errorMessage && (
          <div role="alert" style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</div>
        )}

        {/* 工数データの編集フォーム（送信で handleSubmit を実行） */}
        {/* onKeyDown: 入力欄で Enter を押してもフォーム送信せず、入力欄からフォーカスを外すだけにする */}
        <form
          onSubmit={handleSubmit}
          className={styles["form-edit"]}
          onKeyDown={(e) => {
            // 入力欄（input要素）で Enter キーが押された場合、誤操作による更新を防ぐため送信を止め、
            // フォーカスを外して入力を確定させる
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            {/* 就業日の見出しと工数入力OK/NG判定（OKなら青、NGなら赤で表示） */}
            <label htmlFor="work_day2">就業日:
              <span style={{ color: formData?.judgement ? "blue" : "red", marginLeft: "8px" }}>
                {formData?.judgement ? "OK" : "NG"}
              </span>
            </label>
            {/* 就業日の入力欄と「就業日更新」ボタン（就業日の変更はこのボタンでのみ保存できる） */}
            <div className={styles["day-wrapper"]}>
              <input
                type="date"
                id="work_day2"
                name="work_day2"
                value={formData.work_day2}
                className={styles["form-width"]}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={handleSendDayUpdate}
                className="light_blue_button"
              >
                就業日更新
              </button>
            </div>

            {/* 勤務・直・残業時間の入力欄 */}
            <label htmlFor="tyoku2">勤務・直・残業時間:</label>
            <div className={styles["work-tyoku-wrapper"]}>
              {/* ロック切り替えスイッチ: ON（チェックあり）で勤務・直・残業を編集可能にする */}
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  checked={!isWorkTyokuDisabled}
                  onChange={handleWorkTyokuCheckboxChange}
                />
                {/* スイッチのつまみ部分の見た目 */}
                <span className={styles["toggle-slider"]}></span>
              </label>
              {/* 勤務の選択欄（mode='ALL': 休日・年休なども含む全ての勤務を選べる）と直の選択欄 */}
              <WorkSelect id="work_time" value={formData?.work_time || ''} onChange={handleChange} disabled={isWorkTyokuDisabled} mode='ALL' />
              <TyokuSelect id="tyoku2" value={formData?.tyoku2 || ''} onChange={handleChange} disabled={isWorkTyokuDisabled} />
              {/* 残業時間（分）の入力欄と ±15分 ボタン */}
              <div className={styles["over-time-wrapper"]}>
                {/* 15分減らす */}
                <button
                  type="button"
                  className={styles["custom-button"]}
                  onClick={() => handleDecrement("over_time")}
                  disabled={isWorkTyokuDisabled}
                >
                  -
                </button>
                {/* 残業時間（分）の直接入力欄 */}
                <input
                  type="number"
                  id="over_time"
                  name="over_time"
                  value={formData?.over_time || 0}
                  className={styles["form-width2"]}
                  onChange={handleChange}
                  disabled={isWorkTyokuDisabled}
                />
                {/* 15分増やす */}
                <button
                  type="button"
                  className={styles["custom-button"]}
                  onClick={() => handleIncrement("over_time")}
                  disabled={isWorkTyokuDisabled}
                >
                  +
                </button>
              </div>
            </div>

            {/* 作業行の見出しと「行追加」「行削除」ボタン */}
            <div className={styles["lavel-wrapper"]}>
              <label>
                作業時間・作業内容・作業詳細:
              </label>
              {/* 末尾に空の行を追加する */}
              <button
                type="button"
                className="light_blue_button"
                onClick={addEmptyForm}
              >
                行追加
              </button>
              {/* 末尾の行を画面から取り除く */}
              <button
                type="button"
                className="light_blue_button"
                onClick={removeLastForm}
              >
                行削除
              </button>
            </div>
            {/* 作業行: 作業時間帯1つにつき1行を表示（key には行番号を使う） */}
            {/* 各行の入力欄は、行頭のスイッチが OFF（isDisabled が true）の間は編集できない */}
            {timeData.map((item, index) => (
              <div key={`time-picker-row-${index}`} className={styles["time-picker-wrapper"]}>
                {/* 行のロック切り替えスイッチ: ON（チェックあり）でこの行を編集可能にする */}
                <label className={styles["toggle-switch"]}>
                  <input
                    type="checkbox"
                    checked={!isDisabled[index]}
                    onChange={() => handleCheckboxChange(index)}
                  />
                  {/* スイッチのつまみ部分の見た目 */}
                  <span className={styles["toggle-slider"]}></span>
                </label>
                {/* 開始時刻の選択欄: 24時間表記・5分刻み */}
                {/* onAccept: 時刻を確定してダイアログが閉じたとき、MUIのダイアログ表示中に root 要素へ付く */}
                {/*           aria-hidden 属性（読み上げ対象外にする印）を取り除き、画面が操作対象に戻るようにする */}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <MobileTimePicker
                    key={`time-picker-start-${index}`}
                    className={styles["time-picker"]}
                    value={item.time1}
                    onChange={(newTime) => handleTimeChange("time1", newTime, index)}
                    ampm={false}
                    minutesStep={5}
                    onAccept={() => {
                      // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                      const rootElement = document.getElementById("root");
                      if (rootElement) rootElement.removeAttribute("aria-hidden");
                    }}
                    disabled={isDisabled[index]}
                  />
                </LocalizationProvider>
                {/* 開始と終了の区切り文字 */}
                <span>〜</span>
                {/* 終了時刻の選択欄: 開始時刻と同じ設定 */}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <MobileTimePicker
                    key={`time-picker-end-${index}`}
                    className={styles["time-picker"]}
                    value={item.time2}
                    onChange={(newTime) => handleTimeChange("time2", newTime, index)}
                    ampm={false}
                    minutesStep={5}
                    onAccept={() => {
                      // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                      const rootElement = document.getElementById("root");
                      if (rootElement) rootElement.removeAttribute("aria-hidden");
                    }}
                    disabled={isDisabled[index]}
                  />
                </LocalizationProvider>
                {/* 工数区分の選択欄（変更すると選択肢モードの行では作業詳細も自動で切り替わる） */}
                <DefSelect
                  id={`def-select-${index}`}
                  name={`timeData_work_${index}`}
                  value={item?.work || ""}
                  className={styles["form-width"]}
                  onChange={(e) => handleWorkChange(e, index)}
                  defData={defData}
                  disabled={isDisabled[index]}
                />

                {/* 作業詳細の入力方法の切り替えスイッチ: ON（チェックあり）で手入力、OFF で選択肢から選ぶ */}
                <label className={styles["toggle-switch"]}>
                  <input
                    type="checkbox"
                    checked={isDetailTextMode[index]}
                    onChange={() => handleDetailModeChange(index)}
                    disabled={isDisabled[index]}
                  />
                  {/* スイッチのつまみ部分の見た目 */}
                  <span className={styles["toggle-slider"]}></span>
                </label>

                {/* 作業詳細の入力欄: 手入力モードなら文字入力欄、そうでなければ選択肢のプルダウンを表示 */}
                {isDetailTextMode[index] ? (
                  <input
                    type="text"
                    id={`timeData_detail_${index}`}
                    name={`timeData_detail_${index}`}
                    value={item?.detail || ""}
                    className={styles["form-width"]}
                    onChange={(e) => handleChange(e, index, "detail")}
                    disabled={isDisabled[index]}
                  />
                ) : (
                  <select
                    id={`detail_work_select_${index}`}
                    name={`timeData_detail_${index}`}
                    value={item?.detail || ""}
                    className={styles["form-width"]}
                    onChange={(e) => handleDetailChange(e, index)}
                    disabled={isDisabled[index]}
                  >
                    <option value="">選択してください</option>
                    {/* 作業詳細の選択肢: 工数区分を選んでいればその工数区分のものだけ、未選択なら全件を表示 */}
                    {/* （key には並び順の番号を使う） */}
                    {detailDataList
                      .filter(d => !item.work || d.def_symbol === item.work)
                      .map((d, i) => (
                        <option key={i} value={d.def_select}>{d.def_select}</option>
                      ))
                    }
                  </select>
                )}
                
                {/* この行の時間帯の工数をサーバー上ですぐに削除するボタン（行がロック中は押せない） */}
                <button
                  type="button"
                  className="blue_button"
                  onClick={() => handleDeleteItem(index)}
                  disabled={isDisabled[index]}
                >
                  削除
                </button>
              </div>
            ))}
            {/* 更新ボタン（フォームを送信し handleSubmit を実行） */}
            <button type="submit" className="light_blue_button">更新</button>
          </div>
        </form>
        {/* 取得時点の作業内容がある場合だけ、時刻ごとのグラフと工数区分の凡例を表示 */}
        {initialTimeWork && (
          <div className={styles["centeredContainer"]}>
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
export default KosuEdit;