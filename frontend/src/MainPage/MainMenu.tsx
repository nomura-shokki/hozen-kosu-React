/**
 * ============================================================
 * ファイル名 : MainMenu.tsx
 * 種別       : 画面コンポーネント（メインメニュー画面）
 * 概要       : ログイン後に最初に表示されるトップ画面。
 *              各機能のメニュー画面へのボタンと、問い合わせに関するお知らせ（ポップアップ）を表示する。
 *
 * 主な機能   :
 *   - ログイン者の氏名を表示（「こんにちは 〇〇さん」）
 *   - 問い合わせのお知らせ表示
 *       管理者設定の問い合わせ担当者向け: 新しい問い合わせの通知（管理者設定の pop_up1〜5）
 *       ログイン者本人向け: 自分の問い合わせへの回答通知（人員データの pop_up1〜5）
 *   - 各メニュー画面へのリンク（人員・班員は権限あり、管理者は管理者のみ表示）
 *   - ログアウト
 *   - 管理者設定でONにした場合のみ、バックエンドログ（LogConsole）を表示
 *
 * 使用API    : GET  /api/main_menu/  ログイン者情報と管理者設定の取得（kosu/views/main_views.py の Menu）
 *              POST /api/logout/     ログアウト（kosu/views/main_views.py の Logout）
 * 画面URL    : /                     （index.tsx のルーティング定義）
 * 関連ファイル: styles/MainPage/MainMenu.module.css, Components/Loading.tsx, Components/LogConsole.tsx,
 *              AdministratorPage/AdministratorUpdate.tsx（ログ表示ON/OFFの設定元）, img/*.png
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
// メニュー画面で使う画像（ロゴと各メニューボタンのアイコン）
import Logo from "../img/MenuRogo.png";
import Note from "../img/Note.png";
import Balance from "../img/Balance.png";
import Personnel from "../img/Personnel.png";
import Team from "../img/Team.png";
import Mail from "../img/Mail.png";
import Setting from "../img/Setting.png";
import Loading from "../Components/Loading"; // 読み込み中の表示
import LogConsole from "../Components/LogConsole"; // バックエンドのログを5秒ごとに取得して表示する部品
import styles from "../styles/MainPage/MainMenu.module.css";

// ============================================================
// 定数
// ============================================================

// バックエンドログ表示のON/OFFを保存する localStorage（ブラウザ内の保存領域）のキー名。
// 管理者設定画面（AdministratorUpdate.tsx）で同じキーに "true" / "false" が書き込まれる
const LOG_CONSOLE_VISIBILITY_KEY = "showLogConsole";

// ============================================================
// 型定義
// ============================================================

/** ログイン者の人員データ（GET /api/main_menu/ のレスポンス login_data。一部の項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名（挨拶文に表示）
  shop: string; // ショップ
  authority: boolean; // 権限（true なら人員MENU・班員MENUを表示）
  administrator: boolean; // 管理者（true なら管理者MENUを表示）
  pop_up1: string; // 本人向けお知らせ1の文言（自分の問い合わせに回答が来たときに設定される）
  pop_up_id1: string; // お知らせ1に対応する問い合わせのID（空ならお知らせなし）
  pop_up2: string; // 本人向けお知らせ2の文言
  pop_up_id2: string; // お知らせ2に対応する問い合わせのID
  pop_up3: string; // 本人向けお知らせ3の文言
  pop_up_id3: string; // お知らせ3に対応する問い合わせのID
  pop_up4: string; // 本人向けお知らせ4の文言
  pop_up_id4: string; // お知らせ4に対応する問い合わせのID
  pop_up5: string; // 本人向けお知らせ5の文言
  pop_up_id5: string; // お知らせ5に対応する問い合わせのID
}

/** 管理者設定データ（GET /api/main_menu/ のレスポンス admin_data。一部の項目のみ定義） */
interface Admin {
  administrator_employee_no1: number; // 問い合わせ担当者の従業員番号1（サーバーでは文字列項目のため比較時に Number() で数値化）
  administrator_employee_no2: number; // 問い合わせ担当者の従業員番号2
  administrator_employee_no3: number; // 問い合わせ担当者の従業員番号3
  pop_up1: string; // 担当者向けお知らせ1の文言（新しい問い合わせが登録されたときに設定される）
  pop_up_id1: string; // お知らせ1に対応する問い合わせのID（空ならお知らせなし）
  pop_up2: string; // 担当者向けお知らせ2の文言
  pop_up_id2: string; // お知らせ2に対応する問い合わせのID
  pop_up3: string; // 担当者向けお知らせ3の文言
  pop_up_id3: string; // お知らせ3に対応する問い合わせのID
  pop_up4: string; // 担当者向けお知らせ4の文言
  pop_up_id4: string; // お知らせ4に対応する問い合わせのID
  pop_up5: string; // 担当者向けお知らせ5の文言
  pop_up_id5: string; // お知らせ5に対応する問い合わせのID
}

/** GET /api/main_menu/ のレスポンス全体 */
interface Response {
  login_data: Member; // ログイン者の人員データ
  admin_data: Admin; // 管理者設定データ（最新の1件）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * メインメニュー画面。
 *
 * 表示時にログイン者情報と管理者設定を取得し、権限に応じたメニューボタンと
 * 問い合わせのお知らせを表示する。
 *
 * @returns メインメニュー画面のJSX
 */
const MainMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Member | null>(null); // ログイン者の人員データ（取得前は null）
  const [adminData, setAdminData] = useState<Admin | null>(null); // 管理者設定データ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const navigate = useNavigate(); // 画面遷移用の関数
  // バックエンドログを表示するかどうか。
  // 初期値は localStorage に保存された値（"true" のときだけ表示）。関数で渡すと初回描画時に1度だけ読み込まれる
  const [showLogConsole, setShowLogConsole] = useState<boolean>(() => {
    const cachedValue = localStorage.getItem(LOG_CONSOLE_VISIBILITY_KEY);
    return cachedValue === 'true'; 
  });

  // ---------- 副作用（useEffect） ----------

  // 初回表示時のみ（依存配列が空）: localStorage の変更を監視する
  // storage イベントは「別のタブ・ウィンドウ」で localStorage が変更されたときに発生するため、
  // 別タブの管理者設定画面でログ表示を切り替えると、この画面にも即時反映される
  useEffect(() => {
    /**
     * localStorage 変更時の処理。ログ表示ON/OFFのキーが変わったときだけ state を更新する。
     *
     * @param event - storage イベント（key: 変更されたキー名 / newValue: 変更後の値）
     * @returns なし
     */
    const handleStorageChange = (event: StorageEvent) => {
      // ログ表示ON/OFFのキー以外の変更は無視する
      if (event.key === LOG_CONSOLE_VISIBILITY_KEY) {
        setShowLogConsole(event.newValue === 'true');
      }
    };

    // 監視を開始する
    window.addEventListener('storage', handleStorageChange);

    // 画面を離れるとき（アンマウント時）: 監視を解除する（解除しないと不要な処理が残り続ける）
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);


  // 初回表示時（navigate は通常変わらないため実質1回）: ログイン者情報と管理者設定を取得する
  useEffect(() => {
    /**
     * メインメニューの表示に必要なデータをサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・工数区分定義Ver未選択）ならログイン画面へ遷移する。
     *
     * @returns なし（結果は data / adminData / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/main_menu/ : ログイン者の人員データと最新の管理者設定を取得
        const response = await api.get<Response>("/api/main_menu/");
        const { login_data, admin_data } = response.data;
        setData(login_data);
        setAdminData(admin_data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // その他: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 「ログアウト」ボタン押下時の処理。
   *
   * サーバー側のセッション（ログイン情報）を削除してもらい、ログイン画面へ遷移する。
   *
   * @returns なし
   */
  const handleLogout = async () => {
    try {
      // POST /api/logout/ : サーバー側のセッションを削除する（送信データなし）
      await api.post("/api/logout/", {});
      navigate("/login");
    } catch (err: any) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["page-container"]}>
      {/* メニュー本体（ロゴ・挨拶・お知らせ・メニューボタン・ログアウト） */}
      <div className={styles["menu-wrapper"]}>
        {/* メニュー画面のロゴ画像 */}
        <img src={Logo} alt="Menuロゴ" className={styles["Menu-logo"]} />
        {/* ログイン者への挨拶（例: こんにちは 山田さん） */}
        <p>こんにちは {data ? data.name : ""}さん</p>
        {/* お知らせ欄: 各お知らせは該当する問い合わせ詳細画面へのリンクになっている */}
        <div className={styles["alert-area"]}>
          {/* 担当者向けお知らせ: ログイン者が管理者設定の問い合わせ担当者1〜3のいずれかの場合だけ表示 */}
          {adminData && (Number(adminData.administrator_employee_no1) === data?.employee_no || Number(adminData.administrator_employee_no2) === data?.employee_no || Number(adminData.administrator_employee_no3) === data?.employee_no) && (
            <>
              {/* 管理者設定のお知らせ1〜5: 問い合わせIDが入っている枠だけ表示 */}
              {adminData?.pop_up_id1 && (
                <p><Link to={`/inquir-detail/${adminData?.pop_up_id1}`} className={styles["a-collar"]}>{adminData?.pop_up1}</Link></p>
              )}
              {adminData?.pop_up_id2 && (
                <p><Link to={`/inquir-detail/${adminData?.pop_up_id2}`} className={styles["a-collar"]}>{adminData?.pop_up2}</Link></p>
              )}
              {adminData?.pop_up_id3 && (
                <p><Link to={`/inquir-detail/${adminData?.pop_up_id3}`} className={styles["a-collar"]}>{adminData?.pop_up3}</Link></p>
              )}
              {adminData?.pop_up_id4 && (
                <p><Link to={`/inquir-detail/${adminData?.pop_up_id4}`} className={styles["a-collar"]}>{adminData?.pop_up4}</Link></p>
              )}
              {adminData?.pop_up_id5 && (
                <p><Link to={`/inquir-detail/${adminData?.pop_up_id5}`} className={styles["a-collar"]}>{adminData?.pop_up5}</Link></p>
              )}
            </>
          )}

          {/* 本人向けお知らせ1〜5（自分の問い合わせへの回答通知）: 問い合わせIDが入っている枠だけ表示 */}
          {data?.pop_up_id1 && (
            <p><Link to={`/inquir-detail/${data.pop_up_id1}`} className={styles["a-collar"]}>{data ? data.pop_up1 : ""}</Link></p>
          )}
          {data?.pop_up_id2 && (
            <p><Link to={`/inquir-detail/${data.pop_up_id2}`} className={styles["a-collar"]}>{data ? data.pop_up2 : ""}</Link></p>
          )}
          {data?.pop_up_id3 && (
            <p><Link to={`/inquir-detail/${data.pop_up_id3}`} className={styles["a-collar"]}>{data ? data.pop_up3 : ""}</Link></p>
          )}
          {data?.pop_up_id4 && (
            <p><Link to={`/inquir-detail/${data.pop_up_id4}`} className={styles["a-collar"]}>{data ? data.pop_up4 : ""}</Link></p>
          )}
          {data?.pop_up_id5 && (
            <p><Link to={`/inquir-detail/${data.pop_up_id5}`} className={styles["a-collar"]}>{data ? data.pop_up5 : ""}</Link></p>
          )}
        </div>
        {/* 工数メニュー画面へのボタン（全員に表示） */}
        <Link to="/kosu-menu" className={styles["kosu-menu-button"]}>
          <img src={Note} alt="工数アイコン" className={styles["icon"]} />
          工数MENU
        </Link>
        {/* 工数区分定義メニュー画面へのボタン（全員に表示） */}
        <Link to="/def-menu" className={styles["def-menu-button"]}>
          <img src={Balance} alt="工数区分定義アイコン" className={styles["icon"]} />
          工数定義区分MENU
        </Link>
        {/* 人員メニュー・班員メニューへのボタン: 権限ありの人員のみ表示 */}
        {data?.authority && (
          <>
            <Link to="/member-menu" className={styles["member-menu-button"]}>
              <img src={Personnel} alt="人員アイコン" className={styles["icon"]} />
              人員MENU
            </Link>
            <Link to="/team-menu" className={styles["team-menu-button"]}>
              <img src={Team} alt="班員アイコン" className={styles["icon"]} />
              班員MENU
            </Link>
          </>
        )}
        {/* 問い合わせメニュー画面へのボタン（全員に表示） */}
        <Link to="/inquir-menu" className={styles["inquir-menu-button"]}>
          <img src={Mail} alt="問い合わせアイコン" className={styles["icon"]} />
          問い合わせMENU
        </Link>
        {/* 管理者メニュー画面へのボタン: 管理者のみ表示 */}
        {data?.administrator && (
          <Link to="/manager-menu" className={styles["admin-menu-button"]}>
            <img src={Setting} alt="管理者アイコン" className={styles["icon"]} />
            管理者MENU
          </Link>
        )}
        {/* ログアウトボタン（押すと handleLogout が実行される） */}
        <button onClick={handleLogout} className="blue_button">
          ログアウト
        </button>
      </div>
      {/* バックエンドログ表示: 管理者設定でONにしている場合のみ表示 */}
      {showLogConsole && <LogConsole />}
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default MainMenu;