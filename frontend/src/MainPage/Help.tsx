/**
 * ============================================================
 * ファイル名 : Help.tsx
 * 種別       : 画面コンポーネント（ヘルプ画面 / データ初期化画面）
 * 概要       : ログインできなくなった場合などに、主要データを初期状態へ戻す画面。
 *              最初にパスワード認証を行い、認証に成功した場合だけ初期化フォームを表示する。
 *              ログイン前でも開ける画面（サーバー側は AllowAny＝誰でも呼び出し可）。
 *              初期化を依頼するときも認証時のパスワードを一緒に送り、サーバー側で再確認される。
 *
 * 主な機能   :
 *   - ヘルプ用パスワードによる認証（サーバーの .env の HELP_PATH と照合）
 *   - 人員データ / 工数区分定義データ / 設定データ（管理者設定）のリセット
 *     （選んだデータを全削除し、デフォルトデータを1件だけ登録し直す）
 *   - リセット完了後はログイン画面へ遷移
 *
 * 使用API    : POST /api/help_pass/  パスワード認証（kosu/views/main_views.py の HelpPass）
 *              POST /api/help/       データリセット（kosu/views/main_views.py の Help）
 * 画面URL    : /help                 （index.tsx のルーティング定義）
 * 関連ファイル: styles/MainPage/Help.module.css, MainPage/Login.tsx（ヘルプボタンからこの画面へ遷移）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import styles from "../styles/MainPage/Help.module.css";

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ヘルプ画面（データ初期化画面）。
 *
 * 未認証の間はパスワード入力欄だけを表示し、認証に成功すると
 * リセット対象を選ぶトグルスイッチと「書き込み」ボタンを表示する。
 * 「書き込み」押下時は確認ダイアログを出し、OKのときだけサーバーへ初期化を依頼する。
 *
 * @returns ヘルプ画面のJSX（未認証時は認証フォーム、認証後は初期化フォーム）
 */
const Help: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [isMemberReset, setIsMemberReset] = useState<boolean>(false); // 人員データをリセットするか（トグルON=true）
  const [isDefReset, setIsDefReset] = useState<boolean>(false); // 工数区分定義データをリセットするか
  const [isSettingReset, setIsSettingReset] = useState<boolean>(false); // 設定データ（管理者設定）をリセットするか
  const [errorMessage, setErrorMessage] = useState<string>(""); // 画面上部に赤字で出すエラーメッセージ（空文字なら非表示）
  const [password, setPassword] = useState<string>(""); // 認証フォームに入力中のパスワード
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // パスワード認証に成功したか（true で初期化フォームを表示）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- イベントハンドラ ----------

  /**
   * リセット対象のトグルスイッチ（チェックボックス）が切り替わったときの処理。
   *
   * 3つのスイッチで同じ関数を共用し、押されたチェックボックスの id を見て
   * 対応する state だけを更新する。
   *
   * @param event - チェックボックスの変更イベント
   * @returns なし（isMemberReset / isDefReset / isSettingReset のいずれかを更新）
   */
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // id: どのスイッチか / checked: ONになったか
    const { id, checked } = event.target;
    // 人員データリセットのスイッチ
    if (id === "member-reset") {
      setIsMemberReset(checked);
    // 工数区分定義データリセットのスイッチ
    } else if (id === "def-reset") {
      setIsDefReset(checked);
    // 設定データリセットのスイッチ
    } else if (id === "setting-reset") {
      setIsSettingReset(checked);
    }
  };

  /**
   * 認証フォームの送信処理（パスワード認証）。
   *
   * 入力したパスワードをサーバーへ送り、正しければ isAuthenticated を true にして
   * 初期化フォームを表示する。パスワードはサーバー側の .env（HELP_PATH）と照合される。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし（結果は isAuthenticated / errorMessage の state に反映）
   */
  const handlePasswordSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    // フォーム送信によるページ再読み込み（ブラウザ標準の動作）を止める
    event.preventDefault();
    // 前回のエラー表示を消す
    setErrorMessage("");

    try {
      // POST /api/help_pass/ : 入力パスワードが正しいか判定してもらう
      const res = await api.post("/api/help_pass/", { password });
      // 応答本文が true（または { result: true }）なら認証成功
      if (res.data === true || res.data.result === true) {
        setIsAuthenticated(true);
      } else {
        setErrorMessage("認証に失敗しました。");
      }
    } catch (error) {
      // サーバーはパスワード不一致のとき 403 を返すため、通常の認証失敗もここに来る
      setErrorMessage("認証エラーが発生しました。");
    }
  };

  /**
   * 初期化フォームの送信処理（データリセット）。
   *
   * 処理の流れ:
   *   1. リセット対象が1つも選ばれていなければエラーを表示して終了
   *   2. 確認ダイアログで「キャンセル」なら何もせず終了
   *   3. サーバーへ初期化を依頼し、完了メッセージを出してログイン画面へ遷移
   * 人員データをリセットした場合は、既定の管理者（従業員番号 12345）でしかログインできなくなるため、
   * その旨を完了メッセージで案内する。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし
   */
  const handleSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    // フォーム送信によるページ再読み込みを止め、前回のエラー表示を消す
    event.preventDefault();
    setErrorMessage("");

    // 1. リセット対象が1つも選ばれていない場合は送信しない
    if (!isMemberReset && !isDefReset && !isSettingReset) {
      setErrorMessage("リセットするデータを選択してください。");
      return;
    }

    // 2. データが全削除される重大な操作のため、実行前に確認ダイアログを出す（キャンセルなら中止）
    if (!window.confirm("チェックを入れたデータは全て削除され、初期状態に戻します。本当に実行しますか？")) {
      return;
    }

    try {
      // 3. POST /api/help/ : 選択したデータを全削除し、デフォルトデータを1件登録し直す
      //   memberReset : true なら人員データを初期化（従業員番号12345の管理者のみになる）
      //   defReset    : true なら工数区分定義データを初期化（"default" の定義のみになる）
      //   settingReset: true なら設定データ（管理者設定）を初期化
      //   password    : 認証時に入力したヘルプ用パスワード（サーバーは初期化の前にもう一度これを確認し、
      //                 違う場合は 403 を返して何も削除しない）
      await api.post("/api/help/", { 
        memberReset: isMemberReset, 
        defReset: isDefReset,
        settingReset: isSettingReset,
        password: password,
      });

      // 人員データを初期化した場合は、ログインに使える従業員番号を案内する
      if (isMemberReset) {
        alert("リセットが完了しました。従業員番号：12345でログイン可能です。");
      } else {
        alert("リセットが完了しました。");
      }
      // 完了後はログイン画面へ遷移する（初期化後のデータで改めてログインしてもらうため）
      setErrorMessage("");
      navigate("/login");
    } catch (err: any) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（403: パスワード違い、400: 初期化中のエラーなど）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  // ---------- 描画（JSX） ----------

  // 未認証の間: パスワード入力欄だけの認証フォームを表示する
  if (!isAuthenticated) {
    return (
      <div className={styles["help-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>認証</h1>
        {/* ログイン画面へ戻るリンク */}
        <nav className={styles["help-nav"]}>
          <Link to="/login">ログイン</Link>
        </nav>
        {/* エラーメッセージがあるときだけ赤字で表示 */}
        {errorMessage && (
          <div role="alert" style={{ color: "red" }}>{errorMessage}</div>
        )}
        {/* 認証フォーム: パスワードを入力して「認証」ボタン（またはEnter）で送信 */}
        <form onSubmit={handlePasswordSubmit}>
          <div className={styles["search-bar"]}>
            {/* パスワード入力欄（入力内容は password の state に保存） */}
            <input
              type="password"
              placeholder="パスワードを入力してください"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* 認証ボタン（押すと handlePasswordSubmit が実行される） */}
            <button type="submit" className="gray_button">認証</button>
          </div>
        </form>
      </div>
    );
  }

  // 認証後: リセット対象を選ぶ初期化フォームを表示する
  return (
    <div className={styles["help-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>ヘルプ</h1>
      {/* ログイン画面へ戻るリンク */}
      <nav className={styles["help-nav"]}>
        <Link to="/login">ログイン</Link>
      </nav>

      {/* エラーメッセージがあるときだけ赤字で表示 */}
      {errorMessage && (
        <div role="alert" style={{ color: "red" }}>{errorMessage}</div>
      )}

      {/* 操作説明文 */}
      <p>下記データの内、リセットの必要のあるデータを選択して下さい。</p>
      <p>(選択したデータは全て消え、デフォルトのデータが1件入ります。)</p>

      {/* 初期化フォーム: 「書き込み」ボタンで handleSubmit を実行する */}
      <form 
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // 入力欄でEnterキーを押してもフォームが送信されないようにし、入力欄からフォーカスを外す
          // （Enterキーでの意図しない送信を防ぎ、「書き込み」ボタン押下でのみ送信させるため）
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        <div className={styles["search-bar"]}>
          {/* リセット対象を選ぶトグルスイッチ群（見た目はスイッチだが中身はチェックボックス） */}
          <div className={styles["switch-wrapper"]}>
            {/* 人員データリセットのスイッチ */}
            <label htmlFor="member-reset">人員データリセット:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="member-reset"
                name="member-reset"
                checked={isMemberReset}
                onChange={handleCheckboxChange}
              />
              {/* スイッチのつまみ部分の見た目（CSSで描画） */}
              <span className={styles["toggle-slider"]}></span>
            </label>

            {/* 工数区分定義データリセットのスイッチ */}
            <label htmlFor="def-reset">工数区分定義データリセット:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="def-reset"
                name="def-reset"
                checked={isDefReset}
                onChange={handleCheckboxChange}
              />
              {/* スイッチのつまみ部分の見た目（CSSで描画） */}
              <span className={styles["toggle-slider"]}></span>
            </label>

            {/* 設定データ（管理者設定）リセットのスイッチ */}
            <label htmlFor="setting-reset">設定データリセット:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="setting-reset"
                name="setting-reset"
                checked={isSettingReset}
                onChange={handleCheckboxChange}
              />
              {/* スイッチのつまみ部分の見た目（CSSで描画） */}
              <span className={styles["toggle-slider"]}></span>
            </label>
          </div>
          {/* 送信ボタン（押すと確認ダイアログのあとリセットを実行） */}
          <button type="submit" className="gray_button">書き込み</button>
        </div>
      </form>
      {/* この画面自身（/help）へのリンク。文字を持たず、Help.module.css に help-button クラスの定義もない */}
      <Link to="/help" className={styles["help-button"]}></Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default Help;