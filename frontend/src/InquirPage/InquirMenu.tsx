/**
 * ============================================================
 * ファイル名 : InquirMenu.tsx
 * 種別       : 画面コンポーネント（問い合わせMENU画面）
 * 概要       : 問い合わせ関連の画面へ移動するためのメニュー画面。
 *              表示時にサーバーへ問い合わせてログイン状態を確認し、未ログインならログイン画面へ戻す。
 *
 * 主な機能   :
 *   - ログイン状態の確認（API の結果は画面には使わない）
 *   - 「問い合わせ」（新規登録）・「問い合わせ履歴」（一覧）画面へのリンク
 *   - メインMENUへ戻るリンク
 *
 * 使用API    : GET /api/inquir_menu/  ログイン者の人員データ取得（kosu/views/main_views.py の InquirMenu）
 * 画面URL    : /inquir-menu          （index.tsx のルーティング定義）
 * 関連ファイル: styles/InquirPage/InquirMenu.module.css, Components/Loading.tsx
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
import styles from "../styles/InquirPage/InquirMenu.module.css";



// ============================================================
// 型定義
// ============================================================

/** ログイン者の人員データ（GET /api/inquir_menu/ のレスポンス。一部の項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 問い合わせMENU画面。
 *
 * 表示時に API を呼んでログイン状態を確認する。確認が終わるまではローディング表示を出す。
 *
 * @returns 問い合わせMENU画面のJSX
 */
const InquirMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
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
     * @returns なし（失敗時は error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/inquir_menu/ : ログイン者の人員データを取得（ログインしていなければ 401 が返る）
        await api.get<Member>("/api/inquir_menu/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
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
      <h1 className={styles["h1-collar"]}>問い合わせMENU</h1>
      {/* メインメニュー画面へ戻るリンク */}
      <nav className={styles["inquir-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      {/* 問い合わせ（新規登録）画面へのボタン型リンク */}
      <Link to="/inquir-new" className={styles["inquir-button1"]}>問い合わせ</Link>
      {/* 問い合わせ履歴（一覧）画面へのボタン型リンク */}
      <Link to="/inquir-list" className={styles["inquir-button2"]}>問い合わせ履歴</Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default InquirMenu;