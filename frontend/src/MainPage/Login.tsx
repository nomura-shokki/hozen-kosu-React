/**
 * ============================================================
 * ファイル名 : Login.tsx
 * 種別       : 画面コンポーネント（ログイン画面）
 * 概要       : 従業員番号を入力してログインする画面。
 *              サーバー側で人員データに登録がある従業員番号か確認し、
 *              登録があればセッションにログイン情報と最新の工数区分定義Verが保存される。
 *
 * 主な機能   :
 *   - 従業員番号の入力とログイン処理
 *   - ログイン成功時はメインメニュー（/）へ遷移
 *   - 未登録の番号などのエラー時はサーバーのメッセージを表示
 *   - 画面右下のヘルプボタン（表示から30秒後に現れる「?」）からヘルプ画面へ遷移
 *
 * 使用API    : POST /api/login/  ログイン（kosu/views/main_views.py の Login）
 * 画面URL    : /login            （index.tsx のルーティング定義）
 * 関連ファイル: styles/MainPage/Login.module.css, img/TitleRogo.png, MainPage/Help.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import logo from "../img/TitleRogo.png"; // 画面上部に表示するシステムのロゴ画像
import styles from "../styles/MainPage/Login.module.css";

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ログイン画面。
 *
 * 従業員番号を入力して「ログイン」ボタンを押すとサーバーへ送信し、
 * 成功ならメインメニューへ遷移、失敗ならエラーメッセージを表示する。
 *
 * @returns ログイン画面のJSX
 */
const Login: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [employee_no, setNumber] = useState<string>(""); // 入力中の従業員番号（入力欄の値なので文字列で保持）
  const [errorMessage, setErrorMessage] = useState<string>(""); // ログイン失敗時のエラーメッセージ（空文字なら非表示）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- イベントハンドラ ----------

  /**
   * ログインフォームの送信処理。
   *
   * 入力された従業員番号を数値に変換してサーバーへ送る。
   * サーバーは人員データに登録がある番号ならセッションにログイン情報を保存して
   * { status: "success" } を返し、登録がなければ 400 とエラーメッセージを返す。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし（成功時は画面遷移、失敗時は errorMessage の state に反映）
   */
  const handleSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    // フォーム送信によるページ再読み込み（ブラウザ標準の動作）を止め、前回のエラー表示を消す
    event.preventDefault();
    setErrorMessage("");

    try {
      // POST /api/login/ : 従業員番号でログイン（サーバー側の人員データと照合するため数値に変換して送る）
      const response = await api.post("/api/login/", { employee_no: Number(employee_no) });
      const data = response.data;
      // ログイン成功: メインメニューへ遷移
      if (data.status === "success") {
        navigate("/");
      // 200 で返ったが成功でない場合: サーバーのメッセージ（なければ固定文言）を表示
      } else {
        setErrorMessage(data.message || "サーバーエラーが発生しました。");
      }
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ（この画面自身）
        if (err.response?.status === 401) navigate("/login");
        // その他（400: 未登録の従業員番号・工数区分定義が1件もない など）: サーバーのメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  // ---------- 描画（JSX） ----------

  return (
    <div className={styles["login-wrapper"]}>
      {/* システムのロゴ画像 */}
      <img src={logo} alt="業務工数システムロゴ" className={styles["login-logo"]} />
      {/* ログインフォーム: 「ログイン」ボタンで handleSubmit を実行する */}
      <form 
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // 入力欄でEnterキーを押してもフォームが送信されないようにし、入力欄からフォーカスを外す
          // （Enterキーでの意図しない送信を防ぎ、「ログイン」ボタン押下でのみ送信させるため）
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        {/* フォームの見出し */}
        <h2>ログイン</h2>
        <div className={styles["search-bar"]}>
          {/* 従業員番号の入力欄（数値のみ入力可・未入力では送信不可） */}
          <label htmlFor="numberInput">従業員番号</label>
          <input
            type="number"
            id="numberInput"
            value={employee_no}
            onChange={(e) => {
              // 入力値をそのまま state に保存する（空欄のときは空文字）
              const value = e.target.value;
              setNumber(value === "" ? "" : value);
            }}
            required
            className={styles["input-focus"]}
          />
          {/* エラーメッセージがあるときだけ表示 */}
          {errorMessage && (
            <div role="alert">{errorMessage}</div>
          )}

          {/* ログインボタン */}
          <button type="submit" className="blue_button">ログイン</button>
        </div>
      </form>
      {/* ヘルプ画面へのリンク: 画面右下に固定表示される「?」ボタン（CSSで描画。表示から30秒後にフェードイン） */}
      <Link to="/help" className={styles["help-button"]}></Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default Login;