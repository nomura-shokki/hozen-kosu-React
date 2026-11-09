/**
 * ============================================================
 * ファイル名 : TeamMenu.tsx
 * 種別       : 画面コンポーネント（班員メニュー画面）
 * 概要       : 班員（ログイン者が管理する班のメンバー）に関する各画面への入口となるメニュー画面。
 *              班員フォローが有効な場合は、過去7日間に工数未入力がある班員のお知らせを表示する。
 *
 * 主な機能   :
 *   - 班員の工数未入力お知らせの表示（サーバー側で過去7日分を確認して作成）
 *   - 他の班員画面から渡されたエラーメッセージの表示（班員未登録時など）
 *   - 班員登録 / 班員工数履歴 / 班員工数入力状況 / 班員残業 / 工数入力状況(全体) への遷移
 *
 * 使用API    : GET /api/team_menu/  班員メニュー用データ取得（kosu/views/main_views.py の TeamMenu）
 * 画面URL    : /team-menu            （index.tsx のルーティング定義）
 * 関連ファイル: styles/TeamPage/TeamMenu.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, Link, useLocation } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/TeamPage/TeamMenu.module.css";

// ============================================================
// 型定義
// ============================================================

/** GET /api/team_menu/ のレスポンス */
interface TeamMenuData {
  follow_message_list: string[]; // 工数未入力のお知らせ文の一覧（例: "山田氏の工数未入力があります。"）
  member_data: object; // ログイン者の人員データ（この画面では使用していない）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 班員メニュー画面。
 *
 * 表示時に班員の工数未入力お知らせを取得し、各班員画面へのボタンと一緒に表示する。
 * サーバー側の権限チェック（HasAuthority）により、権限なしの人員は 403 でメインメニューへ戻される。
 *
 * @returns 班員メニュー画面のJSX
 */
const TeamMenu: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [teamMenuData, setTeamMenuData] = useState<TeamMenuData | null>(null); // サーバーから取得したメニュー用データ
  const location = useLocation(); // 現在のURL情報（遷移元から渡された state を読むために使う）
  // 他の班員画面（班員工数履歴・班員工数入力状況・班員残業）から遷移時に渡されたエラーメッセージ
  // （例: 班員が未登録のとき「班員情報を登録してください。」が渡される）
  const redirectedError = location.state?.errorMessage
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回）: メニュー用データを取得する
  useEffect(() => {
    /**
     * 班員メニュー用データ（工数未入力のお知らせ）をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（結果は teamMenuData / error の state に反映）
     */
    const fetchMenuData = async () => {
      try {
        // GET /api/team_menu/ : 班員フォローが有効なら、過去7日間に工数未入力（または入力NG）の班員のお知らせを取得
        const response = await api.get<TeamMenuData>("/api/team_menu/");
        setTeamMenuData(response.data);
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

    fetchMenuData();
  }, [navigate]);

  // お知らせ文の一覧（データ取得前や項目がない場合は空配列にして、表示側の判定を簡単にする）
  const followMessages = teamMenuData?.follow_message_list || [];

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles["menu-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>班員MENU</h1>
      {/* メインメニュー画面へ戻るリンク */}
      <nav className={styles["team-nav"]}>
        <Link to="/">メインMENU</Link>
      </nav>

      {/* 他の班員画面から渡されたエラーメッセージがあるときだけ表示 */}
      {redirectedError && (<div role="alert">{redirectedError}</div>)}

      {/* お知らせ欄: 工数未入力のお知らせが1件以上あるときだけ表示 */}
      {followMessages.length > 0 && (
        <div className={styles["follow-messages"]}>
          <h2>お知らせ</h2>
          {/* お知らせ文を1件ずつ表示（並び替えのない固定の一覧のため key には配列の位置を使う） */}
          {followMessages.map((message, index) => (
            <p key={index} className={styles["follow-message-item"]}>{message}</p>
          ))}
        </div>
      )}

      {/* 各班員画面へのボタン群 */}
      {/* 班員登録画面: 自分の班のメンバー（最大15人）を登録する */}
      <Link to="/team-new" className={styles["team-button1"]}>班員登録</Link>
      {/* 班員工数履歴画面: 班員の工数データを一覧表示する */}
      <Link to="/team-list" className={styles["team-button2"]}>班員工数履歴</Link>
      {/* 班員工数入力状況画面: 1週間分の班員の工数入力状況を表示する */}
      <Link to="/team-calendar" className={styles["team-button3"]}>班員工数入力状況</Link>
      {/* 班員残業画面: 班員の月間の残業時間を表示する */}
      <Link to="/team-overtime" className={styles["team-button4"]}>班員残業</Link>
      {/* ショップ単位工数入力状況画面: 選択したショップの人員の月間の工数入力OK/NGを表示する */}
      <Link to="/team-view" className={styles["team-button5"]}>工数入力状況(全体)</Link>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default TeamMenu;