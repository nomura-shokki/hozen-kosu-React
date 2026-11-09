/**
 * ============================================================
 * ファイル名 : KosuMenu.tsx
 * 種別       : 画面コンポーネント（工数メニュー画面）
 * 概要       : 工数関連の各画面（工数入力・工数履歴・休憩変更・勤務入力・工数集計）への
 *              入口となるメニュー画面。表示時にログイン状態と工数区分定義Verの選択状態を確認する。
 *
 * 主な機能   :
 *   - ログイン・工数区分定義Ver選択済みかの確認（未ログイン等ならログイン画面へ遷移）
 *   - 工数関連の各画面へのリンクボタン表示
 *
 * 使用API    : GET /api/kosu_menu/  ログイン者の人員データ取得（kosu/views/main_views.py の KosuMenu）
 * 画面URL    : /kosu-menu            （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/KosuMenu.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/KosuPage/KosuMenu.module.css";

// ============================================================
// 型定義
// ============================================================

/** ログイン者の人員データ（GET /api/kosu_menu/ のレスポンス。この画面では中身は使わない） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数メニュー画面。
 *
 * 表示時に API を呼び出してログイン状態を確認し、問題なければメニューのリンク群を表示する。
 * API のレスポンス内容は使わず、エラーの有無（401/403 など）だけを判定に使う。
 *
 * @returns 工数メニュー画面のJSX
 */
const KosuMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回）: ログイン状態を確認する
  useEffect(() => {
    /**
     * メニュー表示前のログイン状態確認を行う。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（エラー時は error の state に反映）
     */
    const fetchMenu = async () => {
      try {
        // GET /api/kosu_menu/ : ログイン者の人員データを取得（結果は使わず、ログイン確認のためだけに呼ぶ）
        await api.get<Member>("/api/kosu_menu/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
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
    };

    fetchMenu();
  }, [navigate]);

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>工数MENU</h1>
      {/* メインメニュー画面へ戻るリンク */}
      <nav className={styles["kosu-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      {/* 各画面へのリンクボタン（上から順に背景色を少しずつ濃い青にするため、クラス名を kosu-button1〜5 で分けている） */}
      {/* 工数入力画面へ */}
      <Link to="/kosu-new" className={styles["kosu-button1"]}>工数入力</Link>
      {/* 工数履歴一覧画面へ */}
      <Link to="/kosu-list" className={styles["kosu-button2"]}>工数履歴</Link>
      {/* 休憩時間変更画面（毎日の休憩時間）へ */}
      <Link to="/break-time" className={styles["kosu-button3"]}>休憩変更</Link>
      {/* 勤務入力画面（カレンダーで月単位に勤務・直を入力）へ */}
      <Link to="/kosu-calendar" className={styles["kosu-button4"]}>勤務入力</Link>
      {/* 工数集計画面へ */}
      <Link to="/kosu-total" className={styles["kosu-button5"]}>工数集計</Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuMenu;