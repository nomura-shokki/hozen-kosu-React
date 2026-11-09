/**
 * ============================================================
 * ファイル名 : InquirNew.tsx
 * 種別       : 画面コンポーネント（問い合わせ画面）
 * 概要       : システムへの要望・不具合報告・問い合わせを新規登録する画面。
 *              内容（要望 / 不具合 / 問い合わせ）を選び、本文を入力して登録する。
 *
 * 主な機能   :
 *   - 表示時にログイン状態を確認（API の結果は画面には使わない）
 *   - 内容の選択と問い合わせ本文の入力
 *   - 「登録」ボタンで問い合わせデータを新規登録し、入力欄を空に戻す
 *     （サーバー側では、管理者設定の空いているお知らせ欄に「〇〇さんからの新しい問い合わせ」が書き込まれる）
 *
 * 使用API    : GET  /api/inquir_new/  ログイン者の人員データ取得（kosu/views/inquiry_views.py の InquirNew）
 *              POST /api/inquir_new/  問い合わせデータの新規登録（同上）
 * 画面URL    : /inquir-new           （index.tsx のルーティング定義）
 * 関連ファイル: styles/InquirPage/InquirNew.module.css, Components/ItemSelect.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import ItemSelect from "../Components/ItemSelect"; // 問い合わせ内容（要望/不具合/問い合わせ）のプルダウン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/InquirPage/InquirNew.module.css";

// ============================================================
// 型定義
// ============================================================

/** 入力フォームの値（POST /api/inquir_new/ の送信データ） */
interface FormData {
  content_choice: string; // 内容（"要望" / "不具合" / "問い合わせ"。"" は未選択）
  inquiry: string; // 問い合わせ本文
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 問い合わせ画面（新規登録）。
 *
 * 表示時に API でログイン状態を確認し、フォームを表示する。
 * 登録に成功するとアラートで知らせ、入力欄を空に戻す（画面遷移はしない）。
 *
 * @returns 問い合わせ画面のJSX
 */
const InquirNew: React.FC = () => {
  // ---------- state（画面の状態） ----------

  // 入力フォームの値（初期値はすべて空）
  const [formData, setFormData] = useState<FormData>({
    content_choice: "",
    inquiry: "",
  });

  const [loading, setLoading] = useState(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし。フォームの上に表示）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 表示時に1回実行（navigate は変わらないため実質1回）: ログイン状態を確認する
  useEffect(() => {
    /**
     * サーバーに問い合わせてログイン状態を確認する。
     *
     * 成功時は何もしない（レスポンスは使わない）。401（未ログイン）ならログイン画面へ、
     * 403（権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（失敗時は errorMessage の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/inquir_new/ : ログイン者の人員データを取得（ログインしていなければ 401 が返る）
        await api.get("/api/inquir_new/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * テキスト入力欄（問い合わせ本文）の変更を formData に反映する。
   *
   * 入力欄の name 属性をそのまま formData のキーとして使う（name="inquiry" → formData.inquiry）。
   *
   * @param event - 入力欄の変更イベント
   * @returns なし
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    // 直前の値をコピーし、変更された項目だけ上書きする
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  /**
   * 内容プルダウン（ItemSelect）の変更を formData.content_choice に反映する。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleContentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    // 直前の値をコピーし、内容（content_choice）だけ上書きする
    setFormData((prevData) => ({
      ...prevData,
      content_choice: value,
    }));
  };

  /**
   * 「登録」ボタン押下（フォーム送信）時の処理。
   *
   * 入力内容を POST し、成功したらアラートを出して入力欄を空に戻す。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページの再読み込み）を止め、API 通信で登録する
    event.preventDefault();
    // 前回のエラーメッセージを消す
    setErrorMessage(null);

    try {
      // POST /api/inquir_new/ : 問い合わせデータを新規登録
      //   送信内容: content_choice（内容）, inquiry（本文）
      //   従業員番号・氏名はサーバー側でログイン情報から設定される
      await api.post("/api/inquir_new/", formData);
      alert("登録完了！");

      // 続けて別の問い合わせを入力できるよう、入力欄を空に戻す
      setFormData({
        content_choice: "",
        inquiry: "",
      });
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージをフォームの上に表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 読み込み中表示を終了する（送信処理では true にしていないため、実際には値は変わらない）
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中（ログイン確認中）はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <div className={styles["inquir-new-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>問い合わせ</h1>
      {/* 問い合わせMENU画面へ戻るリンク */}
      <nav className={styles["inquir-nav"]}>
        <Link to="/inquir-menu">問い合わせMENU</Link>
      </nav>

      {/* エラーメッセージ（エラーがあるときだけ表示） */}
      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

      {/* 入力フォーム: 送信で handleSubmit を実行する */}
      {/* onKeyDown: 1行入力欄（input 要素）で Enter を押してもフォームが送信されないよう止め、入力欄からフォーカスを外す */}
      {/* （現在このフォームに input 要素はなく、内容はプルダウン、本文は textarea のため、実際に止める対象はない） */}
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
          {/* 内容（要望/不具合/問い合わせ）の選択 */}
          <label htmlFor="ItemSelect">内容選択:</label>
          <ItemSelect
            id="ItemSelect"
            name="content_choice"
            value={formData.content_choice}
            onChange={handleContentChange}
          />
          {/* 問い合わせ本文の入力欄（5行分の高さ） */}
          <label htmlFor="inquiry">問い合わせ：</label>
          <textarea
            id="inquiry"
            name="inquiry"
            value={formData.inquiry}
            onChange={handleChange}
            rows={5}
          />
          {/* 登録ボタン（type="submit" なので押すとフォームの onSubmit が実行される） */}
          <button type="submit" className="pink_button">登録</button>
        </div>
      </form>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default InquirNew;