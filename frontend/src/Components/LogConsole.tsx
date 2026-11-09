/**
 * ============================================================
 * ファイル名 : LogConsole.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : サーバーのログファイル（web_console.log）の中身を画面上に表示するログ表示欄。
 *              表示中は5秒ごとに最新の内容を取り直す。
 *
 * 主な機能   :
 *   - 表示時と、その後5秒ごとにログの内容を取得して表示する
 *   - 取得中は「Loading log...」、失敗時はエラーメッセージ、空のときは「ログファイルは空です。」を表示する
 *
 * 使用箇所   : MainPage/MainMenu.tsx（メインメニュー画面）, AdministratorPage/AdministratorUpdate.tsx（設定編集画面）。
 *              どちらも、設定編集画面のチェックボックスで表示ONにしたとき（localStorage の showLogConsole が "true"）だけ表示する
 * 使用API    : GET /api/web_console_log/  ログ内容取得（kosu/views/main_views.py の WebConsoleLogView。管理者のみ）
 * 関連ファイル: styles/Components/LogConsole.module.css,
 *              hozen_another/settings.py（LOGGING: views_logger の出力先が web_console.log）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import styles from "../styles/Components/LogConsole.module.css";


// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ログ表示欄。
 *
 * 表示された時点でログを取得し、以後5秒ごとに取得し直して表示を更新する。
 * 画面から消える（アンマウントされる）ときに定期取得を止める。
 *
 * @returns ログ表示欄のJSX
 */
const LogConsole: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [logContent, setLogContent] = useState<string>(""); // 表示するログの全文
  const [loading, setLoading] = useState<boolean>(true); // 初回取得が終わるまで true（「Loading log...」を表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）

  // ---------- 副作用（useEffect） ----------

  // 表示時に1回だけ実行（依存配列が空）: ログを取得し、5秒ごとの定期取得を開始する
  useEffect(() => {
    /**
     * サーバーからログの内容を取得して state に保存する。
     *
     * @returns なし（結果は logContent / loading / error の state に反映）
     */
    const fetchLog = () => {
      // GET /api/web_console_log/ : web_console.log の中身を { log_content: 文字列 } で受け取る
      api
        .get<{ log_content: string }>("/api/web_console_log/")
        .then((response) => {
          // 成功: ログ内容を表示し、読み込み中表示を終える
          setLogContent(response.data.log_content);
          setLoading(false);
        })
        .catch((err) => {
          // 失敗（管理者以外で 403 になった場合なども含む）: 開発者向けにコンソールへ出力し、画面にはエラーメッセージを出す
          console.error("ログの取得中にエラー:", err);
          setError("ログの読み込みに失敗しました。");
          setLoading(false);
        });
    };

    // まず1回取得し、その後は5000ミリ秒（5秒）ごとに取得し直す
    fetchLog();
    const intervalId = setInterval(fetchLog, 5000);

    // クリーンアップ関数（画面から消えるときに定期取得のタイマーを止める）
    return () => clearInterval(intervalId);
  }, []);

  // ---------- 描画（JSX） ----------

  return (
    <div className={styles.consoleContainer}>
      {/* 初回取得中のみ「Loading log...」を表示 */}
      {loading && <div className={styles.loading}>Loading log...</div>}
      {/* エラーがあればメッセージを表示 */}
      {error && <div className={styles.error}>{error}</div>}

      {/* ログ本文（pre 要素なので改行や空白をそのまま表示する） */}
      {/* 内容が空なら、取得中は何も出さず、取得後は「ログファイルは空です。」を表示 */}
      <pre className={styles.consoleOutput}>
        {logContent || (loading ? "" : "ログファイルは空です。")}
      </pre>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default LogConsole;
