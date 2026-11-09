/**
 * ============================================================
 * ファイル名 : MemberNew.tsx
 * 種別       : 画面コンポーネント（人員登録画面）
 * 概要       : 新しい人員（従業員）を登録する画面。権限ありの人員のみ利用できる。
 *              従業員番号・氏名・ショップ・権限・管理者権限を入力して登録する。
 *              休憩時間は画面では入力せず、サーバー側でショップに応じた初期値が設定される。
 *
 * 主な機能   :
 *   - 表示時に利用可否（ログイン・権限）を確認
 *   - 従業員番号・氏名・ショップの入力、権限・管理者権限のON/OFF切り替え
 *   - 登録（登録後は入力欄を初期値に戻して続けて登録できる）
 *
 * 使用API    : GET  /api/member_new/  利用可否の確認（レスポンスは未使用）
 *                                     （kosu/views/member_views.py の MemberNew）
 *              POST /api/member_new/  人員の新規登録（同上）
 * 画面URL    : /member-new            （index.tsx のルーティング定義）
 * 関連ファイル: styles/MemberPage/MemberNew.module.css, Components/ShopSelect.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import ShopSelect from "../Components/ShopSelect"; // ショップを選ぶプルダウン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/MemberPage/MemberNew.module.css";

// ============================================================
// 型定義
// ============================================================

/**
 * 登録フォームの入力内容（POST /api/member_new/ の送信データ）。
 *
 * 休憩時間（break_time〜）は "#HHMMHHMM" 形式（開始時刻と終了時刻）。
 * 番号は直を表す（1=1直, 2=2直, 3=3直, 4=常昼, 5=連1直, 6=連2直）。
 * この画面では "#00000000" を送るが、サーバー側でショップに応じた初期値に上書きされる。
 */
interface FormData {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（true: 人員・班員の管理画面を使える）
  administrator: boolean; // 管理者（true: 管理者・工数区分定義の編集画面を使える）
  break_time1: string; // 1直の昼休憩時間
  break_time1_over1: string; // 1直の残業休憩時間1
  break_time1_over2: string; // 1直の残業休憩時間2
  break_time1_over3: string; // 1直の残業休憩時間3
  break_time2: string; // 2直の昼休憩時間
  break_time2_over1: string; // 2直の残業休憩時間1
  break_time2_over2: string; // 2直の残業休憩時間2
  break_time2_over3: string; // 2直の残業休憩時間3
  break_time3: string; // 3直の昼休憩時間
  break_time3_over1: string; // 3直の残業休憩時間1
  break_time3_over2: string; // 3直の残業休憩時間2
  break_time3_over3: string; // 3直の残業休憩時間3
  break_time4: string; // 常昼の昼休憩時間
  break_time4_over1: string; // 常昼の残業休憩時間1
  break_time4_over2: string; // 常昼の残業休憩時間2
  break_time4_over3: string; // 常昼の残業休憩時間3
  break_time5: string; // 連1直の昼休憩時間
  break_time5_over1: string; // 連1直の残業休憩時間1
  break_time5_over2: string; // 連1直の残業休憩時間2
  break_time5_over3: string; // 連1直の残業休憩時間3
  break_time6: string; // 連2直の昼休憩時間
  break_time6_over1: string; // 連2直の残業休憩時間1
  break_time6_over2: string; // 連2直の残業休憩時間2
  break_time6_over3: string; // 連2直の残業休憩時間3
  break_check: boolean; // 休憩エラー有効チェック
  def_prediction: boolean; // ※人員モデル（models.py の member）には現在この項目はなく、サーバー側では使われない
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 人員登録画面。
 *
 * 表示時に利用可否を確認し、問題なければ空の入力フォームを表示する。
 * 登録ボタンでサーバーへ送信し、成功したら入力欄を初期値に戻す。
 *
 * @returns 人員登録画面のJSX
 */
const MemberNew: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 画面上部に出すエラーメッセージ（null ならエラーなし）
  // 入力フォームの内容。休憩時間は "#00000000"（0:00〜0:00）を仮の値として入れておく
  //   （サーバー側の登録処理でショップに応じた初期値に置き換えられる）
  const [formData, setFormData] = useState<FormData>({
    employee_no: 0,
    name: "",
    shop: "",
    authority: false,
    administrator: false,
    break_time1: "#00000000",
    break_time1_over1: "#00000000",
    break_time1_over2: "#00000000",
    break_time1_over3: "#00000000",
    break_time2: "#00000000",
    break_time2_over1: "#00000000",
    break_time2_over2: "#00000000",
    break_time2_over3: "#00000000",
    break_time3: "#00000000",
    break_time3_over1: "#00000000",
    break_time3_over2: "#00000000",
    break_time3_over3: "#00000000",
    break_time4: "#00000000",
    break_time4_over1: "#00000000",
    break_time4_over2: "#00000000",
    break_time4_over3: "#00000000",
    break_time5: "#00000000",
    break_time5_over1: "#00000000",
    break_time5_over2: "#00000000",
    break_time5_over3: "#00000000",
    break_time6: "#00000000",
    break_time6_over1: "#00000000",
    break_time6_over2: "#00000000",
    break_time6_over3: "#00000000",
    break_check: false,
    def_prediction: false,
  });

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: この画面を使ってよいかをサーバーに確認する
  useEffect(() => {
    /**
     * 人員登録APIを GET で呼び出し、利用可否を確認する。
     *
     * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（エラー時は errorMessage の state に反映）
     */
    const checkAuth = async () => {
      try {
        // GET /api/member_new/ : 権限ありのログイン者かを確認（レスポンスの中身は使わない）
        await api.get("/api/member_new/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし（人員の「権限」が付いていない） → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 入力欄・プルダウン・チェックボックスの変更時の処理。
   *
   * 入力欄の name 属性（例: "name"、"authority"）と同じ名前の項目を更新する。
   * チェックボックス（権限・管理者権限）はチェック状態（true/false）を、それ以外は入力値を入れる。
   *
   * @param event - 入力欄・プルダウン・チェックボックスの変更イベント
   * @returns なし（formData の state に反映）
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    // チェックボックス: checked（true/false）を保存する
    if (type === "checkbox") {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      // テキスト・数値入力・プルダウン: 入力値（文字列）をそのまま保存する
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  /**
   * 「登録」ボタン押下（フォーム送信）時の処理。
   *
   * 入力内容をサーバーへ送り、成功したら完了メッセージを出して入力欄を初期値に戻す
   * （画面は移動しないので、続けて別の人員を登録できる）。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();
    // 前回のエラー表示を消す
    setErrorMessage(null);

    try {
      // POST /api/member_new/ : 人員を新規登録する（休憩時間はサーバー側でショップに応じて設定される）
      await api.post("/api/member_new/", formData);
      alert("登録完了！");

      // 成功: 続けて入力できるよう、入力欄を初期表示時と同じ値に戻す
      setFormData({
        employee_no: 0,
        name: "",
        shop: "",
        authority: false,
        administrator: false,
        break_time1: "#00000000",
        break_time1_over1: "#00000000",
        break_time1_over2: "#00000000",
        break_time1_over3: "#00000000",
        break_time2: "#00000000",
        break_time2_over1: "#00000000",
        break_time2_over2: "#00000000",
        break_time2_over3: "#00000000",
        break_time3: "#00000000",
        break_time3_over1: "#00000000",
        break_time3_over2: "#00000000",
        break_time3_over3: "#00000000",
        break_time4: "#00000000",
        break_time4_over1: "#00000000",
        break_time4_over2: "#00000000",
        break_time4_over3: "#00000000",
        break_time5: "#00000000",
        break_time5_over1: "#00000000",
        break_time5_over2: "#00000000",
        break_time5_over3: "#00000000",
        break_time6: "#00000000",
        break_time6_over1: "#00000000",
        break_time6_over2: "#00000000",
        break_time6_over3: "#00000000",
        break_check: false,
        def_prediction: false,
      });
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 従業員番号の重複・入力チェックNG）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <div className={styles["member-new-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>人員登録</h1>
      {/* 人員メニュー画面へ戻るリンク */}
      <nav className={styles["member-nav"]}>
        <Link to="/member-menu">人員MENU</Link>
      </nav>

      {/* エラーメッセージがあるときだけ表示（role="alert" で読み上げソフトにも通知） */}
      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

      {/* 登録フォーム: 送信で handleSubmit を実行する。
          入力欄（input要素）で Enter キーが押されたときは、誤送信を防ぐため送信を止めてフォーカスを外す */}
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
          {/* 従業員番号の入力欄（数値入力） */}
          <label htmlFor="employee_no">従業員番号:</label>
          <input
            type="number"
            id="employee_no"
            name="employee_no"
            value={formData.employee_no}
            onChange={handleChange}
          />

          {/* 氏名の入力欄 */}
          <label htmlFor="name">氏名:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />

          {/* ショップのプルダウン（選択したショップによってサーバー側で休憩時間の初期値が変わる） */}
          <label htmlFor="shop">ショップ:</label>
          <ShopSelect
            name="shop"
            value={formData.shop}
            onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
          />

          {/* 権限の切り替えスイッチ（チェックボックスを CSS でトグルスイッチ風に見せる） */}
          <div className={styles["switch-wrapper"]}>
            <label htmlFor="authority">権限:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="authority"
                name="authority"
                checked={formData.authority}
                onChange={handleChange}
              />
              {/* スイッチの見た目部分（背景とつまみを CSS で描画する、表示専用の要素） */}
              <span className={styles["toggle-slider"]}></span>
            </label>
          </div>

          {/* 管理者権限の切り替えスイッチ（チェックボックスを CSS でトグルスイッチ風に見せる） */}
          <div className={styles["switch-wrapper"]}>
            <label htmlFor="administrator">管理者権限:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="administrator"
                name="administrator"
                checked={formData.administrator}
                onChange={handleChange}
              />
              {/* スイッチの見た目部分（背景とつまみを CSS で描画する、表示専用の要素） */}
              <span className={styles["toggle-slider"]}></span>
            </label>
          </div>
          {/* 登録ボタン */}
          <button type="submit" className="yellow_button">登録</button>
        </div>
      </form>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default MemberNew;