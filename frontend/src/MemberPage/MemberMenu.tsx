/**
 * ============================================================
 * ファイル名 : MemberMenu.tsx
 * 種別       : 画面コンポーネント（人員メニュー画面）
 * 概要       : 人員（従業員）管理の各画面へ移動するためのメニュー画面。
 *              表示時にAPIを呼び、この画面を使ってよいか（ログイン・権限）だけを確認する。
 *
 * 主な機能   :
 *   - 利用可否の確認（未ログインならログイン画面、権限なしならメインメニューへ戻す）
 *   - 人員登録画面・人員一覧画面へのボタン
 *
 * 使用API    : GET /api/member_menu/  利用可否の確認（kosu/views/main_views.py の MemberMenu）
 * 画面URL    : /member-menu            （index.tsx のルーティング定義）
 * 関連ファイル: styles/MemberPage/MemberMenu.module.css, Components/Loading.tsx
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
import styles from "../styles/MemberPage/MemberMenu.module.css";

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 人員メニュー画面。
 *
 * 表示時に GET /api/member_menu/ を呼び、エラーにならなければメニューボタンを表示する。
 * レスポンスの中身（ログイン者の人員データ）は使わず、利用可否の確認だけに使う。
 *
 * @returns 人員メニュー画面のJSX
 */
const MemberMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: この画面を使ってよいかをサーバーに確認する
  useEffect(() => {
    /**
     * 人員メニューAPIを呼び出し、利用可否を確認する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（エラー時は error の state に反映）
     */
    const fetchMemberMenu = async () => {
      try {
        // GET /api/member_menu/ : 権限ありのログイン者かを確認（レスポンスの中身は使わない）
        await api.get("/api/member_menu/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし（人員の「権限」が付いていない） → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchMemberMenu();
  }, [navigate]);

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>人員MENU</h1>
      {/* メインメニュー画面へ戻るリンク */}
      <nav className={styles["member-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      {/* 人員登録画面へのボタン */}
      <Link to="/member-new" className={styles["member-button1"]}>人員登録</Link>
      {/* 人員一覧画面へのボタン */}
      <Link to="/member-list" className={styles["member-button2"]}>人員一覧</Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default MemberMenu;