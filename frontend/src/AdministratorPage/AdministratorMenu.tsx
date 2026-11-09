/**
 * ============================================================
 * ファイル名 : AdministratorMenu.tsx
 * 種別       : 画面コンポーネント（管理者メニュー画面）
 * 概要       : 管理者向けの各機能画面へのリンクを並べたメニュー画面。
 *              表示時にAPIで管理者権限を確認し、権限がなければ他画面へ戻す。
 *
 * 主な機能   :
 *   - 管理者権限の確認（API呼び出しの成否で判定）
 *   - 設定変更 / データ管理 / 全工数データ管理 / 非同期タスクデータ管理 /
 *     データ操作履歴管理 の各画面へのリンク表示
 *
 * 使用API    : GET /api/manager_menu/  管理者権限の確認（kosu/views/main_views.py の AdministratorMenu）
 * 画面URL    : /manager-menu            （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorMenu.module.css, Components/Loading.tsx
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
import styles from "../styles/AdministratorPage/AdministratorMenu.module.css";



// ============================================================
// 型定義
// ============================================================

/**
 * ログイン者の人員データ（api.get の型指定に使用）。
 *
 * ※実際の GET /api/manager_menu/ のレスポンスは { login_data, admin_data } の形だが、
 *   この画面ではレスポンスの中身を使わないため表示には影響しない。
 */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 管理者メニュー画面。
 *
 * 表示時に GET /api/manager_menu/ を呼び、成功すれば（＝管理者権限あり）メニューを表示する。
 * 失敗した場合はステータスコードに応じてログイン画面・メインメニューへ遷移するか、エラーを表示する。
 *
 * @returns 管理者メニュー画面のJSX
 */
const AdministratorMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: 管理者権限をAPIで確認する
  useEffect(() => {
    /**
     * 管理者メニューAPIを呼び出し、管理者権限があるかを確認する。
     *
     * レスポンスの中身は使わず、エラーにならなければ権限ありとみなしてメニューを表示する。
     *
     * @returns なし（失敗時は画面遷移、または error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/manager_menu/ : 管理者権限の確認（管理者でなければ 403 が返る）
        await api.get<Member>("/api/manager_menu/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
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

    fetchData();
  }, [navigate]);

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>管理者MENU</h1>
      {/* メインメニュー画面へ戻るリンク */}
      <nav className={styles["admin-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      {/* 管理者設定の変更画面へ */}
      <Link to="/manager-update" className={styles["admin-button1"]}>設定変更</Link>
      {/* 各データのバックアップ・復元・削除を行うデータ管理画面へ */}
      <Link to="/manager-loading" className={styles["admin-button2"]}>データ管理</Link>
      {/* 全人員の工数データの一覧・編集画面へ */}
      <Link to="/manager-kosu" className={styles["admin-button3"]}>全工数データ管理</Link>
      {/* 非同期タスク（バックアップ/復元などのバックグラウンド処理）の一覧画面へ */}
      <Link to="/manager-task" className={styles["admin-button4"]}>非同期タスクデータ管理</Link>
      {/* 操作履歴（データ変更の監査ログ）の一覧画面へ */}
      <Link to="/manager-history" className={styles["admin-button5"]}>データ操作履歴管理</Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default AdministratorMenu;