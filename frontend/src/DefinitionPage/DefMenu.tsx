/**
 * ============================================================
 * ファイル名 : DefMenu.tsx
 * 種別       : 画面コンポーネント（工数区分定義メニュー画面）
 * 概要       : 工数区分定義（作業カテゴリの定義セット）関連の各画面へ移動するためのメニュー画面。
 *              ログイン者が管理者の場合だけ、登録・一覧などの管理用ボタンを追加で表示する。
 *
 * 主な機能   :
 *   - ログイン者の人員データを取得し、管理者かどうかを判定
 *   - 工数区分定義確認・工数区分定義切り替え画面へのボタン（全員に表示）
 *   - 工数区分定義登録・一覧、作業詳細選択肢登録・一覧画面へのボタン（管理者のみ表示）
 *
 * 使用API    : GET /api/def_menu/  ログイン者の人員データ取得（kosu/views/main_views.py の DefMenu）
 * 画面URL    : /def-menu            （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefMenu.module.css, Components/Loading.tsx
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
import styles from "../styles/DefinitionPage/DefMenu.module.css";



// ============================================================
// 型定義
// ============================================================

/** ログイン者の人員データ（GET /api/def_menu/ のレスポンス。画面で使う項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（true: 人員・班員の管理画面を使える）
  administrator: boolean; // 管理者（true: 管理用ボタンを表示する）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義メニュー画面。
 *
 * 表示時にログイン者の人員データを取得し、管理者かどうかで表示するボタンを切り替える。
 *
 * @returns 工数区分定義メニュー画面のJSX
 */
const DefMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Member | null>(null); // ログイン者の人員データ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: ログイン者の人員データを取得する
  useEffect(() => {
    /**
     * ログイン者の人員データをサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（結果は data / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/def_menu/ : ログイン者の人員データを取得（管理者かどうかの判定に使う）
        const response = await api.get<Member>("/api/def_menu/");
        setData(response.data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
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
      <h1 className={styles["h1-collar"]}>工数区分定義MENU</h1>
      {/* メインメニュー画面へ戻るリンク */}
      <nav className={styles["def-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>
      {/* 工数区分定義確認画面へのボタン（全員に表示） */}
      <Link to="/def-search" className={styles["def-button1"]}>工数区分定義確認</Link>
      {/* 管理者（administrator が true）の場合のみ、登録・一覧系の管理用ボタンを表示 */}
      {data?.administrator && (
        <>
          {/* 工数区分定義登録画面へのボタン */}
          <Link to="/def-new" className={styles["def-button2"]}>工数区分定義登録</Link>
          {/* 工数区分定義一覧画面へのボタン */}
          <Link to="/def-list" className={styles["def-button3"]}>工数区分定義一覧</Link>
          {/* 作業詳細選択肢登録画面へのボタン */}
          <Link to="/def-detail-new" className={styles["def-button4"]}>作業詳細選択肢登録</Link>
          {/* 作業詳細選択肢一覧画面へのボタン */}
          <Link to="/def-detail-list" className={styles["def-button5"]}>作業詳細選択肢一覧</Link>
        </>
      )}
      {/* 工数区分定義切り替え画面へのボタン（全員に表示） */}
      <Link to="/def-ver" className={styles["def-button6"]}>工数区分定義切り替え</Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefMenu;