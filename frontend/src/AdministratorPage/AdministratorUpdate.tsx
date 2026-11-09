/**
 * ============================================================
 * ファイル名 : AdministratorUpdate.tsx
 * 種別       : 画面コンポーネント（管理者設定編集画面）
 * 概要       : 管理者設定（一覧表示項目数・問い合わせ担当者の従業員番号）を編集して保存する画面。
 *              あわせて、バックエンドのログ（web_console.log）を画面下部に表示するかを切り替えられる。
 *
 * 主な機能   :
 *   - 現在の管理者設定の取得とフォームへの表示
 *   - 入力チェック（一覧表示項目数・担当者従業員番号は自然数のみ）と保存
 *   - バックエンドログ表示のON/OFF（設定はブラウザの localStorage に保存）
 *
 * 使用API    : GET /api/manager_update/  管理者設定の取得（kosu/views/main_views.py の AdministratorUpdate）
 *              PUT /api/manager_update/  管理者設定の更新（同上。存在しない従業員番号は 406 エラー）
 * 画面URL    : /manager-update            （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorUpdate.module.css,
 *              Components/Loading.tsx, Components/LogConsole.tsx（ログ表示部品）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import LogConsole from "../Components/LogConsole"; // バックエンドログを5秒ごとに取得して表示する部品
import styles from "../styles/AdministratorPage/AdministratorUpdate.module.css";



// ============================================================
// 定数
// ============================================================

// ログ表示ON/OFFを localStorage（ブラウザに値を保存する仕組み）に保存するときのキー名。
// チェックボックスの id / name にも同じ値を使い、handleChange でどの入力欄かを見分ける
const LOG_CONSOLE_VISIBILITY_KEY = "showLogConsole";

// ============================================================
// 型定義
// ============================================================

/** 管理者設定のうち、この画面で編集する項目（GET /api/manager_update/ の admin_data） */
interface Admin {
  menu_row: number; // 一覧表示項目数（各一覧画面の1ページの件数）
  administrator_employee_no1: number | null; // 問い合わせ担当者1の従業員番号（未設定なら null）
  administrator_employee_no2: number | null; // 問い合わせ担当者2の従業員番号（未設定なら null）
  administrator_employee_no3: number | null; // 問い合わせ担当者3の従業員番号（未設定なら null）
}

/** ログイン者の人員データ（GET /api/manager_update/ の login_data。この画面では未使用） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（一般より上の操作権限）の有無
  administrator: boolean; // 管理者権限の有無
}

/** GET /api/manager_update/ のレスポンス */
interface Response {
  admin_data: Admin; // 現在の管理者設定
  login_data: Member; // ログイン者の人員データ
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 管理者設定編集画面。
 *
 * 表示時に現在の管理者設定を取得してフォームに表示し、「編集」ボタンで入力チェック後に保存する。
 * 保存に成功するとメインメニューへ遷移する。
 *
 * @returns 管理者設定編集画面のJSX
 */
const AdminUpdate: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<Admin | null>(null); // フォームの入力内容（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  // バックエンドログを表示するかどうか。初期値は localStorage に保存された前回の設定
  // （関数を渡すと初回表示時の1回だけ実行される）
  const [showLogConsole, setShowLogConsole] = useState<boolean>(() => {
    const cachedValue = localStorage.getItem(LOG_CONSOLE_VISIBILITY_KEY);
    // 保存値は文字列のため、"true" のときだけ表示ONとする（未保存なら null → OFF）
    return cachedValue === 'true'; 
  });

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: 現在の管理者設定を取得する
  useEffect(() => {
    /**
     * 管理者設定をサーバーから取得し、フォームの初期値として state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（結果は formData / errorMessage の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/manager_update/ : 現在の管理者設定（最も新しい1件）を取得
        const response = await api.get<Response>("/api/manager_update/");
        // レスポンスから admin_data を取り出してフォームの初期値にする
        const { admin_data } = response.data;
        setFormData(admin_data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを保存
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

  // ログ表示ON/OFFが変わったとき: その値を localStorage に保存し、次回表示時も同じ状態にする
  useEffect(() => {
    localStorage.setItem(LOG_CONSOLE_VISIBILITY_KEY, String(showLogConsole));
  }, [showLogConsole]);

  // ---------- イベントハンドラ ----------

  /**
   * 入力欄・チェックボックスの値が変わったときの処理。
   *
   * ログ表示のチェックボックスなら showLogConsole を切り替える。
   * それ以外は入力欄の name と同じ名前の項目を formData に反映する（数値項目は数値に変換）。
   *
   * @param event - 入力欄の変更イベント
   * @returns なし
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // name: 入力欄の名前（= formData の項目名）、value: 入力値、type: 入力欄の種類
    const { name, value, type } = event.target;
    // チェックボックスの場合のみ、チェック状態（true/false）を取り出す
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox && (event.target as HTMLInputElement).checked;

    // ログ表示のチェックボックス: 表示ON/OFFだけを切り替えて終了（formData には含めない）
    if (name === LOG_CONSOLE_VISIBILITY_KEY && isCheckbox) {
      setShowLogConsole(checked);
      return;
    }

    // 数値として扱う項目かどうか（入力値は文字列で届くため変換が必要）
    const isNumberField = [
      "menu_row",
      "administrator_employee_no1",
      "administrator_employee_no2",
      "administrator_employee_no3",
    ].includes(name);

    // 数値項目: 空欄なら null（未設定）、それ以外は10進数の整数に変換（例: "123" → 123）
    // 数値以外の項目: 入力値の文字列のまま
    const newValue = isNumberField
      ? value === ""
        ? null
        : parseInt(value, 10)
      : value;

    // 変更された項目だけを差し替えた新しいオブジェクトを state に保存する
    setFormData((prevData) => {
      // まだデータを取得できていない場合は何もしない
      if (!prevData) return null;
      return {
        ...prevData,
        [name]: newValue,
      } as Admin;
    });
  };

  /**
   * 「編集」ボタン（フォーム送信）時の処理。
   *
   * 入力チェックを行い、問題がなければ管理者設定を保存してメインメニューへ遷移する。
   * 入力エラーやサーバーエラーの場合はメッセージを画面に表示する。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページの再読み込み）を止める
    event.preventDefault();
    // 前回のエラーメッセージを消す
    setErrorMessage(null);

    // データ未取得なら送信しない
    if (!formData) return;

    // 入力チェック1: 一覧表示項目数は1以上の数値（空欄・0以下はエラー）
    if (formData.menu_row === null || formData.menu_row <= 0) {
      setErrorMessage("一覧表示項目数は自然数で入力してください。");
      return;
    }

    // 入力チェック2の対象: 問い合わせ担当者の従業員番号3項目
    //   key: formData の項目名 / label: メッセージ用の名称（末尾の数字だけを使う）
    const employeeNumbers = [
      { key: "administrator_employee_no1", label: "担当者1" },
      { key: "administrator_employee_no2", label: "担当者2" },
      { key: "administrator_employee_no3", label: "担当者3" },
    ] as const;

    // 入力チェック2: 担当者の従業員番号は、入力されている場合のみ1以上の数値であること
    for (const field of employeeNumbers) {
      const val = formData[field.key];
      // 未入力（null / undefined / 数値変換失敗 / 空文字）は「担当者なし」として許可する
      if (val === null || val === undefined || Number.isNaN(val) || (typeof val === 'string' && val === "")) {
        continue;
      }
      // 0以下はエラー（label の末尾1文字＝担当者番号をメッセージに入れる。例: "担当者2" → "2"）
      if (val <= 0) {
        setErrorMessage(`問い合わせ担当者従業員番号${field.label.slice(-1)}は自然数で入力してください。`);
        return;
      }
    }

    try {
      // PUT /api/manager_update/ : 入力内容で管理者設定を更新
      //   （サーバー側で従業員番号が人員データに存在するかも確認される）
      await api.put("/api/manager_update/", formData);
      alert("登録完了！");
      // 保存後はメインメニューへ遷移する
      navigate("/");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（406: 従業員番号が存在しない / 400: 入力エラー など）: サーバーのメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 読み込み中表示を終了する
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // 管理者設定を取得できなかった場合はメッセージだけを出す
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <div className={styles["page-container"]}>
      {/* 読み込み中表示（この時点では loading は false のため表示されない） */}
      <Loading isLoading={loading} />
      <div className={styles["admin-update-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        {/* 管理者メニュー画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

      {/* エラーメッセージがある場合のみ表示する */}
      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

        {/* 設定入力フォーム: 入力欄で Enter を押しても送信せず、入力欄からフォーカスを外すだけにする */}
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
            {/* 一覧表示項目数（各一覧画面の1ページの件数） */}
            <label htmlFor="menu_row">一覧表示項目数：</label>
            <input
              id="menu_row"
              name="menu_row"
              type="number"
              value={formData.menu_row}
              onChange={handleChange}
            />
            {/* 問い合わせ担当者1の従業員番号（null のときは空欄で表示） */}
            <label htmlFor="administrator_employee_no1">問い合わせ担当者従業員番号1：</label>
            <input
              id="administrator_employee_no1"
              name="administrator_employee_no1"
              type="number"
              value={formData.administrator_employee_no1 ?? ""}
              onChange={handleChange}
            />
            {/* 問い合わせ担当者2の従業員番号（null のときは空欄で表示） */}
            <label htmlFor="administrator_employee_no2">問い合わせ担当者従業員番号2：</label>
            <input
              id="administrator_employee_no2"
              name="administrator_employee_no2"
              type="number"
              value={formData.administrator_employee_no2 ?? ""}
              onChange={handleChange}
            />
            {/* 問い合わせ担当者3の従業員番号（null のときは空欄で表示） */}
            <label htmlFor="administrator_employee_no3">問い合わせ担当者従業員番号3：</label>
            <input
              id="administrator_employee_no3"
              name="administrator_employee_no3"
              type="number"
              value={formData.administrator_employee_no3 ?? ""}
              onChange={handleChange}
            />

            {/* バックエンドログ表示のON/OFFを切り替えるトグルスイッチ（見た目は CSS で作っている） */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor={LOG_CONSOLE_VISIBILITY_KEY}>バックエンドログ表示:</label>
              <label className={styles["toggle-switch"]}>
                {/* 実体はチェックボックス（CSS で非表示にし、隣の span をスイッチの形に見せる） */}
                <input
                  type="checkbox"
                  id={LOG_CONSOLE_VISIBILITY_KEY}
                  name={LOG_CONSOLE_VISIBILITY_KEY}
                  checked={showLogConsole}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
            {/* 送信ボタン（押すと handleSubmit が実行される） */}
            <button type="submit" className="gray_button">編集</button>
          </div>
        </form>
      </div>
      {/* ログ表示がONのときだけ、バックエンドログの表示欄を出す */}
      {showLogConsole && <LogConsole />}
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default AdminUpdate;