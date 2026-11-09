/**
 * ============================================================
 * ファイル名 : AdministratorKosuUpdate.tsx
 * 種別       : 画面コンポーネント（全工数データ編集画面）
 * 概要       : 管理者が任意の人員の工数データ1件を直接編集・削除する画面。
 *              作業内容（time_work）・作業詳細（detail_work）を1時間ごとの入力欄に分けて表示し、
 *              保存時に元の1本の文字列に戻して送信する。
 *
 * 主な機能   :
 *   - URLのIDに対応する工数データの取得とフォームへの表示
 *   - 従業員番号・工数区分定義Ver・就業日・就業形態・直・作業内容・作業詳細・残業時間・
 *     休憩時間・工数入力OK/NG判定・休憩変更チェックの編集
 *   - 入力チェック（必須項目・作業詳細の区切り数・休憩時間の形式）と保存
 *   - 工数データの削除（確認ダイアログあり）
 *
 * 使用API    : GET    /api/manager_kosu_update/<id>/  工数データ1件と工数区分定義Ver一覧の取得
 *              PUT    /api/manager_kosu_update/<id>/  工数データ1件の更新
 *              DELETE /api/manager_kosu_update/<id>/  工数データ1件の削除
 *              （いずれも kosu/views/main_views.py の AdministratorKosuUpdate）
 * 画面URL    : /manager-kosu-update/:id               （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorKosuUpdate.module.css,
 *              Components/Loading.tsx, Components/DefVersionSelect.tsx,
 *              Components/WorkSelect.tsx, Components/TyokuSelect.tsx,
 *              AdministratorPage/AdministratorKosuList.tsx（遷移元・保存/削除後の遷移先）,
 *              kosu/utils/kosu_utils.py（作業内容・作業詳細のデータ形式の説明）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import DefVersionSelect from "../Components/DefVersionSelect"; // 工数区分定義Verの選択プルダウン
import WorkSelect from "../Components/WorkSelect"; // 就業形態の選択プルダウン
import TyokuSelect from "../Components/TyokuSelect"; // 直の選択プルダウン
import styles from "../styles/AdministratorPage/AdministratorKosuUpdate.module.css";



// ============================================================
// 型定義
// ============================================================

/** 編集対象の工数データ（GET /api/manager_kosu_update/<id>/ の kosu_data。PUT の送信内容にもなる） */
interface Kosu {
  employee_no3: number; // 従業員番号
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"）
  time_work: string; // 作業内容（5分1コマ×288コマ分の工数区分記号を並べた文字列）
  detail_work: string; // 作業詳細（288コマ分の作業詳細を "$" でつないだ文字列）
  over_time: number; // 残業時間（分）
  work_time: string; // 就業形態（出勤・休日出勤・年休 など）
  def_ver2: string; // 工数区分定義Ver名
  breaktime: string; // 昼休憩時間（"#HHMMHHMM" 形式＝開始時刻と終了時刻）
  breaktime_over1: string; // 残業休憩時間1（"#HHMMHHMM" 形式）
  breaktime_over2: string; // 残業休憩時間2（"#HHMMHHMM" 形式）
  breaktime_over3: string; // 残業休憩時間3（"#HHMMHHMM" 形式）
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
  break_change: boolean; // 休憩変更チェック（true: 工数入力時に休憩時間を作業内容へ自動で書き込まない）
}

/** 工数データの持ち主の人員データ（GET /api/manager_kosu_update/<id>/ の member_data。この画面では未使用） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
}

/** 工数区分定義Verの選択肢1件分（GET /api/manager_kosu_update/<id>/ の choices の要素） */
interface DefData {
  id: number; // 工数区分定義のID（主キー）
  kosu_name: string; // 工数区分定義Ver名
}

/** GET /api/manager_kosu_update/<id>/ のレスポンス */
interface Response {
  kosu_data: Kosu; // 編集対象の工数データ
  member_data: Member; // 工数データの持ち主の人員データ
  choices: DefData[]; // 工数区分定義Verの選択肢（全件）
  current_version: string; // ログイン時に選択された工数区分定義Ver名（この画面では未使用）
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 作業内容（288文字）を1時間ごと（12文字ずつ）の24個に分割する。
 *
 * 1文字が5分1コマなので、12文字で1時間分になる。
 * 例: 先頭12文字 → 0時台、次の12文字 → 1時台、…、最後の12文字 → 23時台
 *
 * @param timeWork - 作業内容の文字列（通常288文字）
 * @returns 24要素の配列（各要素は最大12文字。足りない部分は空文字）
 */
const splitTimeWork = (timeWork: string): string[] => {
  const segments: string[] = [];
  // i 時台 = i×12 文字目から (i+1)×12 文字目の手前まで（例: 8時台 → 96〜107文字目）
  for (let i = 0; i < 24; i++) {
    segments.push(timeWork.slice(i * 12, (i + 1) * 12) || "");
  }
  return segments;
};

/**
 * 1時間ごとに分割した作業内容を、1本の文字列（288文字）に戻す。
 *
 * 各要素が12文字に満たない場合は、末尾を半角スペースで埋めて12文字にしてからつなぐ
 * （時刻とコマ位置のずれを防ぐため）。
 *
 * @param segments - 24要素の作業内容の配列
 * @returns つなぎ合わせた作業内容の文字列
 */
const joinTimeWorkSegments = (segments: string[]): string => {
  return segments.map(segment => {
    return segment.padEnd(12, ' ');
  }).join('');
};

/**
 * 作業詳細（"$" 区切りの288要素）を1時間ごと（12要素ずつ）の24個に分割する。
 *
 * 各要素は12個の作業詳細を "$" でつないだ文字列になる（"$" は11個）。
 * 例: "点検$$$$$$$$$$$" → 0分の作業詳細が「点検」、残り11コマは空
 *
 * @param detailWork - 作業詳細の文字列（"$" 区切り）
 * @returns 24要素の配列（各要素は12個の作業詳細を "$" でつないだ文字列）
 */
const splitDetailWork = (detailWork: string): string[] => {
  // "$" で区切って288要素に揃える（多ければ切り捨て、足りなければ空文字を追加）
  const elements = detailWork.split('$').slice(0, 288);
  while (elements.length < 288) {
    elements.push('');
  }
  
  // 12要素ずつ取り出し、"$" でつないで1時間分の文字列にする
  const segments: string[] = [];
  for (let i = 0; i < 24; i++) {
    const segmentElements = elements.slice(i * 12, (i + 1) * 12);
    segments.push(segmentElements.join('$'));
  }
  return segments;
};

/**
 * 1時間ごとに分割した作業詳細を、1本の "$" 区切り文字列に戻す。
 *
 * 各要素を "$" で分解して1つの配列にまとめ、先頭288要素を "$" でつなぐ。
 *
 * @param segments - 24要素の作業詳細の配列
 * @returns "$" 区切りの作業詳細の文字列（最大288要素）
 */
const joinDetailWorkSegments = (segments: string[]): string => {
  // flatMap: 各要素を分解した配列を1つの配列に平らにまとめる
  const allElements = segments.flatMap(segment => segment.split('$'));
  return allElements.slice(0, 288).join('$');
};

/**
 * "HHMM" 形式の時刻が正しいか判定する（5分刻みのみ有効）。
 *
 * 例: "1200" → true、"2400" → false（時が範囲外）、"1203" → false（5分刻みでない）
 *
 * @param timeStr - 判定する時刻文字列（数字4桁）
 * @returns true: 有効な時刻 / false: 無効な時刻
 */
const isValidTimeFormat = (timeStr: string): boolean => {
  // 正規表現 ^\d{4}$ : 先頭から末尾までちょうど数字4桁であること
  if (!/^\d{4}$/.test(timeStr)) return false;
  
  // 先頭2桁を時、後ろ2桁を分として数値にする
  const hour = parseInt(timeStr.substring(0, 2), 10);
  const minute = parseInt(timeStr.substring(2, 4), 10);

  // 時は 0〜23、分は 0〜59 かつ5の倍数（工数は5分単位で管理しているため）
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59 || minute % 5 !== 0) return false;

  return true;
};

/**
 * 休憩時間の入力値が "#HHMMHHMM" 形式として正しいかチェックする。
 *
 * 空欄はチェック対象外（エラーなし）とする。
 * 例: "#12001300" → OK（12:00〜13:00）、"12001300" → 形式エラー、"#12001303" → 終了時刻エラー
 *
 * @param breakTimeValue - 休憩時間の入力値
 * @param fieldName      - エラーメッセージに入れる項目名（例: "昼休憩時間"）
 * @returns エラーメッセージ。問題がなければ null
 */
const validateBreakTime = (breakTimeValue: string, fieldName: string): string | null => {
  // 空欄はエラーにしない
  if (breakTimeValue === "") {
    return null; 
  }

  // 正規表現 ^#(\d{8})$ : 先頭が "#"、続いて数字8桁で終わること（数字8桁を取り出す）
  const regex = /^#(\d{8})$/;
  const match = breakTimeValue.match(regex);
  
  // 形式が合わない場合はエラー
  if (!match) {
    return `${fieldName} のフォーマットが正しくありません。#と8桁の数字（例: #12001300）で入力してください。`;
  }

  // 数字8桁のうち、前半4桁が開始時刻・後半4桁が終了時刻
  const timeNumbers = match[1];
  const startTimeStr = timeNumbers.substring(0, 4);
  const endTimeStr = timeNumbers.substring(4, 8);

  // 開始時刻・終了時刻がそれぞれ有効な時刻（5分刻み）かを確認する
  if (!isValidTimeFormat(startTimeStr)) {
    return `${fieldName} の開始時刻 ${startTimeStr} が無効な時刻（00:00〜23:55、5分刻み）です。`;
  }
  if (!isValidTimeFormat(endTimeStr)) {
    return `${fieldName} の終了時刻 ${endTimeStr} が無効な時刻（00:00〜23:55、5分刻み）です。`;
  }
  return null;
};


// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 全工数データ編集画面。
 *
 * 表示時にURLの :id に対応する工数データを取得してフォームに表示する。
 * 「更新」ボタンで入力チェック後に保存、「削除」ボタンで確認のうえ削除し、全工数管理画面へ戻る。
 *
 * @returns 全工数データ編集画面のJSX
 */
const AdministratorKosuUpdate: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（編集する工数データのID）
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<Kosu | null>(null); // フォームの入力内容（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [choices, setChoices] = useState<DefData[]>([]); // 工数区分定義Verの選択肢
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  // 作業内容を1時間ごとに分けた24個の入力値（0時台〜23時台。各12文字）
  const [timeWorkSegments, setTimeWorkSegments] = useState<string[]>(Array(24).fill(""));
  // 作業詳細を1時間ごとに分けた24個の入力値（0時台〜23時台。各12要素を "$" でつないだ文字列）
  const [detailWorkSegments, setDetailWorkSegments] = useState<string[]>(Array(24).fill(""));

  // ---------- 副作用（useEffect） ----------

  // 初回表示時と URL の id が変わったとき: 編集対象の工数データを取得する
  useEffect(() => {
    /**
     * 工数データ1件と工数区分定義Verの選択肢をサーバーから取得し、state に保存する。
     *
     * 作業内容・作業詳細は1時間ごとの入力欄に表示するため、24個に分割して保存する。
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（結果は formData / timeWorkSegments / detailWorkSegments / choices / errorMessage の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/manager_kosu_update/<id>/ : 工数データ1件と工数区分定義Ver一覧を取得
        //   （サーバー側では編集前の就業日・従業員番号をセッションに保存し、PUT 時の重複チェックに使う）
        const response = await api.get<Response>(`/api/manager_kosu_update/${id}/`);
        const { kosu_data, choices } = response.data;
        setFormData(kosu_data);
        // 作業内容・作業詳細を1時間ごとの24個に分割して入力欄用に保存する
        setTimeWorkSegments(splitTimeWork(kosu_data.time_work));
        setDetailWorkSegments(splitDetailWork(kosu_data.detail_work));
        setChoices(choices);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: データなし など）: サーバーが返したメッセージを保存
          else setErrorMessage(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * テキスト・数値・日付の入力欄とチェックボックスの値が変わったときの処理。
   *
   * 入力欄の name と同じ名前の項目を formData に反映する。
   * チェックボックスは true/false、従業員番号・残業時間は数値、それ以外は文字列のまま保存する。
   *
   * @param e - 入力欄の変更イベント
   * @returns なし
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // データ取得前は何もしない
    if (formData) {
      // name: 入力欄の名前（= formData の項目名）、value: 入力値、type: 入力欄の種類、checked: チェック状態
      const { name, value, type, checked } = e.target;
      
      let updatedValue: string | number | boolean;
      
      // 入力欄の種類・項目に応じて保存する値の型を決める
      if (type === 'checkbox') {
        // チェックボックス: チェック状態（true/false）
        updatedValue = checked;
      } else if (name === 'employee_no3' && type === 'number') {
        // 従業員番号: 数値に変換（空欄は 0 になる）
        updatedValue = Number(value);
      } else if (name === 'over_time' && type === 'number') {
        // 残業時間: 数値に変換（空欄は 0 になる）
        updatedValue = Number(value); 
      } else {
        // その他（就業日・休憩時間など）: 入力値の文字列のまま
        updatedValue = value;
      }

      // 変更された項目だけを差し替えた新しいオブジェクトを state に保存する
      setFormData({
        ...formData,
        [name]: updatedValue,
      });
    }
  };

  /**
   * 作業内容の入力欄（index 時台）の変更時に呼ぶ関数を作る。
   *
   * 「index を受け取って、イベント処理関数を返す」形にして、24個の入力欄で使い回す。
   *
   * @param index - 何時台の入力欄か（0〜23）
   * @returns 入力欄の onChange に渡すイベント処理関数
   */
  const handleSegmentChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    // 1時間分は12コマなので、12文字を超える部分は切り捨てる
    const newValue = e.target.value.slice(0, 12);
    // 該当する時間帯の要素だけを差し替えた新しい配列を保存する（元の配列は直接変更しない）
    setTimeWorkSegments(prevSegments => {
      const newSegments = [...prevSegments];
      newSegments[index] = newValue;
      return newSegments;
    });
  };

  /**
   * 作業詳細の入力欄（index 時台）の変更時に呼ぶ関数を作る。
   *
   * 「index を受け取って、イベント処理関数を返す」形にして、24個の入力欄で使い回す。
   * "$" の個数チェックは送信時（handleSubmit）に行う。
   *
   * @param index - 何時台の入力欄か（0〜23）
   * @returns 入力欄の onChange に渡すイベント処理関数
   */
  const handleDetailSegmentChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // 該当する時間帯の要素だけを差し替えた新しい配列を保存する（元の配列は直接変更しない）
    setDetailWorkSegments(prevSegments => {
      const newSegments = [...prevSegments];
      newSegments[index] = newValue;
      return newSegments;
    });
  };


  /**
   * プルダウン（工数区分定義Ver・就業形態・直）の変更時に呼ぶ関数を作る。
   *
   * 「項目名を受け取って、イベント処理関数を返す」形にして、複数のプルダウンで使い回す。
   *
   * @param key - 更新する formData の項目名（例: "def_ver2"）
   * @returns プルダウンの onChange に渡すイベント処理関数
   */
  const handleSelectChange = (key: keyof Kosu) => (e: ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;

    // データ取得前は何もしない。取得済みなら指定項目だけを差し替えて保存する
    if (formData) {
      setFormData({
        ...formData,
        [key]: newValue,
      });
    }
  };

  /**
   * 数値項目（残業時間）を15増やす（入力欄のすぐ右の「+」ボタン用）。
   *
   * @param field - 増やす formData の項目名（例: "over_time"）
   * @returns なし
   */
  const handleIncrement = (field: keyof Kosu) => {
    if (formData) {
      // 未設定（null など）の場合は 0 として計算する
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) + 15 });
    }
  };
  /**
   * 数値項目（残業時間）を1増やす（右端の「+」ボタン用）。
   *
   * @param field - 増やす formData の項目名（例: "over_time"）
   * @returns なし
   */
  const handleIncrement2 = (field: keyof Kosu) => {
    if (formData) {
      // 未設定（null など）の場合は 0 として計算する
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) + 1 });
    }
  };
  /**
   * 数値項目（残業時間）を15減らす（入力欄のすぐ左の「-」ボタン用）。
   *
   * @param field - 減らす formData の項目名（例: "over_time"）
   * @returns なし
   */
  const handleDecrement = (field: keyof Kosu) => {
    if (formData) {
      // 未設定（null など）の場合は 0 として計算する
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) - 15 });
    }
  };
  /**
   * 数値項目（残業時間）を1減らす（左端の「-」ボタン用）。
   *
   * @param field - 減らす formData の項目名（例: "over_time"）
   * @returns なし
   */
  const handleDecrement2 = (field: keyof Kosu) => {
    if (formData) {
      // 未設定（null など）の場合は 0 として計算する
      const currentValue = formData[field] as number;
      setFormData({ ...formData, [field]: (currentValue || 0) - 1 });
    }
  };

  /**
   * 「更新」ボタン（フォーム送信）時の処理。
   *
   * 入力チェック（従業員番号・就業日の必須、作業詳細の区切り数、休憩時間の形式）を行い、
   * 問題がなければ作業内容・作業詳細を1本の文字列に戻して保存し、全工数管理画面へ戻る。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページの再読み込み）を止める
    event.preventDefault();

    // データ未取得なら送信しない
    if (!formData) return;

    // 前回のエラーメッセージを消す
    setErrorMessage(null);

    // 入力チェック1: 従業員番号は必須（空欄は 0 に変換されているため 0 もエラー）
    if (!formData.employee_no3 || formData.employee_no3 === 0) {
      setErrorMessage("従業員番号は必須です。空欄や0は許可されません。");
      return;
    }

    // 入力チェック2: 就業日は必須
    if (!formData.work_day2) {
      setErrorMessage("就業日は必須です。空欄は許可されません。");
      return;
    }

    // 入力チェック3: 各時間帯の作業詳細は12要素（区切りの "$" がちょうど11個）であること
    // （個数がずれると、作業詳細と時刻の対応がずれてしまうため）
    for (let i = 0; i < detailWorkSegments.length; i++) {
      const segment = detailWorkSegments[i];
      // 正規表現 /\$/g で "$" をすべて探し、その個数を数える（見つからなければ 0）
      const dollarCount = (segment.match(/\$/g) || []).length;

      // 個数が違えばエラー（メッセージの時間帯は画面のラベルと同じく i + 1 で表示する）
      if (dollarCount !== 11) {
        setErrorMessage(`${i + 1}時台作業詳細のフォームは12要素にしてください（$が11個必要です）。`);
        return;
      }
    }

    // 入力チェック4の対象: 休憩時間4項目（[formData の項目名, メッセージ用の項目名]）
    const breakTimeFields: Array<[keyof Kosu, string]> = [
      ["breaktime", "昼休憩時間"],
      ["breaktime_over1", "残業休憩時間1"],
      ["breaktime_over2", "残業休憩時間2"],
      ["breaktime_over3", "残業休憩時間3"],
    ];

    // 入力チェック4: 休憩時間は空欄か "#HHMMHHMM" 形式（5分刻み）であること
    for (const [fieldKey, fieldName] of breakTimeFields) {
      const value = formData[fieldKey] as string;
      const error = validateBreakTime(value, fieldName);
      if (error) {
        setErrorMessage(error);
        return;
      }
    }

    // 1時間ごとに分けていた作業内容・作業詳細を、保存用の1本の文字列に戻す
    const updatedTimeWork = joinTimeWorkSegments(timeWorkSegments);
    const updatedDetailWork = joinDetailWorkSegments(detailWorkSegments);
    // 送信データ: フォームの内容に、つなぎ直した作業内容・作業詳細を上書きしたもの
    const dataToSubmit = { 
      ...formData, 
      time_work: updatedTimeWork,
      detail_work: updatedDetailWork,
    };

    try {
      // PUT /api/manager_kosu_update/<id>/ : 工数データを更新
      //   （サーバー側で従業員番号の存在と、同じ人・同じ就業日の工数データが既にないかを確認する）
      await api.put(`/api/manager_kosu_update/${id}/`,dataToSubmit);
      alert("データが更新されました！");
      // 保存後は全工数管理画面へ戻る
      navigate("/manager-kosu");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（400: 従業員番号が未登録・就業日の重複・入力エラー など）: サーバーのメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  /**
   * 「削除」ボタン押下時の処理。
   *
   * 確認ダイアログで OK が押された場合のみ工数データを削除し、全工数管理画面へ戻る。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // URLにIDがない場合は削除できないため何もしない
    if (!id) return;

    // 確認ダイアログでキャンセルされたら何もしない
    if (!window.confirm("このデータを完全に削除してもよろしいですか？この操作は元に戻せません。")) {
      return;
    }

    // 前回のエラーメッセージを消す
    setErrorMessage(null);

    try {
      // DELETE /api/manager_kosu_update/<id>/ : 工数データ1件を削除
      await api.delete(`/api/manager_kosu_update/${id}/`);
      alert("データが削除されました！");
      // 削除後は全工数管理画面へ戻る
      navigate("/manager-kosu");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404: データなし など）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      // 読み込み中表示を終了する
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // 工数データを取得できなかった場合はメッセージだけを出す
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      {/* 読み込み中表示（この時点では loading は false のため表示されない） */}
      <Loading isLoading={loading} />
      <div className={styles["admin-kosu-update-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>全工数データ編集</h1>
        {/* 全工数管理画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-kosu">全工数履歴一覧</Link>
        </nav>

        {/* エラーメッセージ（フォームの上側。エラーがある場合のみ赤枠で表示） */}
        {errorMessage && (
          <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}>{errorMessage}</div>
        )}

        {/* 編集フォーム: 入力欄で Enter を押しても送信せず、入力欄からフォーカスを外すだけにする */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            {/* 従業員番号 */}
            <label htmlFor="employee_no3">従業員番号:</label>
            <input
              type="number"
              name="employee_no3"
              id="employee_no3"
              value={formData.employee_no3}
              onChange={handleChange}
            />
            {/* 工数区分定義Ver（選択肢はサーバーから受け取った choices） */}
            <label htmlFor="def_ver2">工数区分定義:</label>
            <DefVersionSelect
              id="def_ver2"
              choices={choices}
              selectedVersion={formData.def_ver2}
              onChange={handleSelectChange("def_ver2")}
            />
            {/* 就業日 */}
            <label htmlFor="work_day2">就業日:</label>
            <input
              type="date"
              id="work_day2"
              name="work_day2"
              value={formData.work_day2}
              onChange={handleChange}
            />
            {/* 就業形態（mode='ALL': 休日・年休などを含むすべての就業形態を選択肢にする） */}
            <label htmlFor="work_time">勤務形態:</label>
            <WorkSelect
              id="work_time"
              value={formData?.work_time || ""}
              onChange={handleSelectChange("work_time")}
              mode='ALL'
            />
            {/* 直 */}
            <label htmlFor="tyoku2">直:</label>
            <TyokuSelect
              id="tyoku2"
              value={formData?.tyoku2 || ""}
              onChange={handleSelectChange("tyoku2")}
            />
            {/* 作業内容: 24個の入力欄を1時間ごとに表示（各12文字＝5分×12コマ。key は時間帯の番号） */}
            {/* ※index 0 は 0:00〜0:55 のコマだが、ラベルは index + 1 のため「1時台」〜「24時台」と表示される */}
            {timeWorkSegments.map((segment, index) => (
              <div key={`time_work_${index}`} className={styles["work-log-form-container"]}>
                <label htmlFor={`time_work_segment_${index}`}>{index + 1}時台作業内容:</label>
                <input
                  type="text"
                  id={`time_work_segment_${index}`}
                  value={segment}
                  onChange={handleSegmentChange(index)}
                  maxLength={12}
                  minLength={12}
                />
              </div>
            ))}
            {/* 作業詳細: 24個の入力欄を1時間ごとに表示（各12要素を "$" 区切り。key は時間帯の番号。ラベルの番号は作業内容と同じく index + 1） */}
            {detailWorkSegments.map((segment, index) => (
              <div key={`detail_work_${index}`} className={styles["work-log-form-container"]}>
                <label htmlFor={`detail_work_segment_${index}`}>{index + 1}時台作業詳細:</label>
                <input
                  type="text"
                  id={`detail_work_segment_${index}`}
                  value={segment}
                  onChange={handleDetailSegmentChange(index)}
                />
              </div>
            ))}
            {/* 残業時間（分）: 左から「-1」「-15」入力欄「+15」「+1」の順に並ぶ */}
            <label htmlFor="over_time">残業:</label>
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
              {/* 残業時間の入力欄（未設定なら 0 を表示） */}
              <input
                type="number"
                name="over_time"
                id="over_time"
                value={formData?.over_time || 0}
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
            {/* 昼休憩時間（"#HHMMHHMM" 形式。未設定なら空欄で表示） */}
            <label htmlFor="breaktime">昼休憩時間:</label>
            <input
              type="text"
              name="breaktime"
              id="breaktime"
              value={formData?.breaktime || ""}
              onChange={handleChange}
            />
            {/* 残業休憩時間1（"#HHMMHHMM" 形式） */}
            <label htmlFor="breaktime_over1">残業休憩時間1:</label>
            <input
              type="text"
              name="breaktime_over1"
              id="breaktime_over1"
              value={formData?.breaktime_over1 || ""}
              onChange={handleChange}
            />
            {/* 残業休憩時間2（"#HHMMHHMM" 形式） */}
            <label htmlFor="breaktime_over2">残業休憩時間2:</label>
            <input
              type="text"
              name="breaktime_over2"
              id="breaktime_over2"
              value={formData?.breaktime_over2 || ""}
              onChange={handleChange}
            />
            {/* 残業休憩時間3（"#HHMMHHMM" 形式） */}
            <label htmlFor="breaktime_over3">残業休憩時間3:</label>
            <input
              type="text"
              name="breaktime_over3"
              id="breaktime_over3"
              value={formData?.breaktime_over3 || ""}
              onChange={handleChange}
            />
            {/* 工数入力OK/NG判定のトグルスイッチ（実体はチェックボックス。見た目は CSS で作っている） */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="judgement">整合性:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="judgement"
                  name="judgement"
                  checked={formData?.judgement || false}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
            {/* 休憩変更チェックのトグルスイッチ（実体はチェックボックス。見た目は CSS で作っている） */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="break_change">休憩変更チェック:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="break_change"
                  name="break_change"
                  checked={formData?.break_change || false}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            {/* エラーメッセージ（ボタンの直前にも同じ内容を表示し、入力欄が長くても気付けるようにする） */}
            {errorMessage && (
              <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}>{errorMessage}</div>
            )}

            {/* 更新ボタン（押すと handleSubmit が実行される） */}
            <button type="submit" className="gray_button" style={{ marginTop: '20px' }}>更新</button>
            {/* 削除ボタン（赤色。押すと確認ダイアログを出してから削除する） */}
            <button 
              type="button"
              className="gray_button" 
              style={{ marginTop: '20px', backgroundColor: '#dc3545', color: 'white' }}
              onClick={handleDelete}
            >
              削除
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default AdministratorKosuUpdate;