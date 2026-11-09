/**
 * ============================================================
 * ファイル名 : Loading.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : データ読み込み中に表示する「Loading...」画面。
 *              ヘルメットの画像を揺らすアニメーションと文字を表示する。
 *
 * 主な機能   :
 *   - 読み込み中（isLoading=true）はローディング表示を出す
 *   - 読み込みが終わると（isLoading=false）1秒かけてフェードアウトし、その後は何も描画しない
 *
 * 使用箇所   : ほぼすべての画面（工数・人員・班員・工数区分定義・問い合わせ・管理者の各画面、メインメニュー画面）。
 *              多くの画面は「if (loading) return <Loading isLoading={loading} />」の形で、読み込み中だけ表示している
 * 関連ファイル: styles/Components/Loading.module.css, img/helmet.png
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useEffect, useState } from "react";
import helmetImage from "../img/helmet.png"; // 静的リソースの画像（ローディング中に揺れるヘルメット）
import styles from "../styles/Components/Loading.module.css";

// ============================================================
// 型定義
// ============================================================

/** Loading が親コンポーネントから受け取る props（部品に渡す設定値） */
interface LoadingProps {
  isLoading: boolean; // ローディング状態を受け取るためのプロパティ（true: 読み込み中 / false: 読み込み完了）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ローディング表示。
 *
 * isLoading が false になると、CSS の fadeOut クラスを付けて透明にしていき（1秒）、
 * 1秒後に shouldRender を false にして要素ごと描画をやめる。
 *
 * @param props - LoadingProps を参照
 * @returns ローディング表示のJSX。フェードアウト完了後は null（何も表示しない）
 */
const Loading: React.FC<LoadingProps> = ({ isLoading }) => {
  // ---------- state（画面の状態） ----------
  const [shouldRender, setShouldRender] = useState(true); // フェードアウト後に完全削除（false になったら何も描画しない）

  // ---------- 副作用（useEffect） ----------

  // isLoading が変わったとき: 読み込みが終わっていれば、1秒後に描画をやめるタイマーを開始する
  useEffect(() => {
    if (!isLoading) {
      // ローディング終了後にフェードアウトを開始
      const timeout = setTimeout(() => {
        setShouldRender(false); // 完全にレンダリングを停止
      }, 1000); // CSSトランジションと同期（1秒）。Loading.module.css の transition: opacity 1s と同じ長さ
      return () => clearTimeout(timeout); // コンポーネントアンマウント時にクリーンアップ（タイマーを止める）
    }
  }, [isLoading]);

  // ---------- 描画（JSX） ----------

  if (!shouldRender) return null; // レンダリングを停止

  // 画面全体を覆うローディング表示（読み込み完了後は fadeOut クラスが追加されて徐々に透明になる）
  return (
    <div
      id="loading"
      className={`${styles.loading} ${!isLoading ? styles.fadeOut : ""}`} // フェードアウト時にクラス追加
    >
      {/* 揺れるヘルメット画像（sway クラスで左右に揺らすアニメーション） */}
      <div className={styles.item}>
        <img
          id="loadingImg"
          src={helmetImage}
          alt="Loading..."
          className={styles.sway}
        />
      </div>
      {/* 「Loading...」の文字 */}
      <p className={styles.loadingText}>Loading...</p>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default Loading;