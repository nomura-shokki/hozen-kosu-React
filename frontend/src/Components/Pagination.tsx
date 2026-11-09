/**
 * ============================================================
 * ファイル名 : Pagination.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 一覧画面の下に置く、ページ切り替えボタン（最初 / 前 / 次 / 最後）と
 *              「現在のページ / 総ページ数」の表示。
 *
 * 主な機能   :
 *   - ボタン押下で、親コンポーネントから渡された setCurrentPage を呼んでページ番号を変える
 *   - 1ページ目では「最初」「前」、最終ページでは「次」「最後」を押せなくする
 *   - ボタンの色を画面ごとに指定できる（CSS変数で Pagination.module.css に渡す）
 *
 * 使用箇所   : KosuPage/KosuList.tsx（工数履歴一覧画面）, MemberPage/MemberList.tsx（人員一覧画面）,
 *              TeamPage/TeamList.tsx（班員工数履歴画面）, DefinitionPage/DefList.tsx（工数区分定義一覧画面）,
 *              DefinitionPage/DefDetailList.tsx（作業詳細選択肢一覧画面）, InquirPage/InquirList.tsx（問い合わせ履歴画面）,
 *              AdministratorPage/AdministratorKosuList.tsx（全工数管理画面）,
 *              AdministratorPage/AdministratorTaskList.tsx（非同期タスクデータ管理画面）,
 *              AdministratorPage/AdministratorHistoryList.tsx（データ操作履歴一覧画面）
 * 関連ファイル: styles/Components/Pagination.module.css
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";
import styles from "../styles/Components/Pagination.module.css";

// ============================================================
// 型定義
// ============================================================

/** Pagination が親コンポーネントから受け取る props（部品に渡す設定値） */
interface PaginationProps {
  currentPage: number; // 現在表示しているページ番号（1始まり）
  totalPages: number; // 総ページ数
  setCurrentPage: (page: number) => void; // ページ番号を変更する親側の関数（通常は useState の更新関数をそのまま渡す）
  buttonColor?: string; // ボタンの背景色（例: "#0ff"）。省略時は白（"#fff"）
  hoverColor?: string; // マウスを乗せたときのボタンの背景色。省略時は白（"#fff"）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ページ切り替えボタン群。
 *
 * この部品自身はページ番号を保持せず、ボタンが押されたら親の setCurrentPage を呼ぶだけ。
 * 親側はページ番号の変化をきっかけに（useEffect などで）一覧データを取得し直す。
 *
 * @param props - PaginationProps を参照
 * @returns ページ切り替えボタン群のJSX
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  setCurrentPage,
  buttonColor = "#fff",
  hoverColor = "#fff",
}) => {
  // ---------- イベントハンドラ ----------

  // 「最初」: 1ページ目へ移動
  const handleFirstPage = () => setCurrentPage(1);
  // 「最後」: 最終ページへ移動
  const handleLastPage = () => setCurrentPage(totalPages);
  // 「次」: 最終ページより前にいるときだけ1ページ進める
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  // 「前」: 2ページ目以降にいるときだけ1ページ戻る
  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // ---------- 描画（JSX） ----------

  // 外枠の style で CSS変数（--btn-bg-color / --btn-hover-color）にボタン色を設定し、
  // Pagination.module.css 側で var(--btn-bg-color) のように参照させる。
  // CSS変数は React の style の型定義に無いため、as React.CSSProperties で型を合わせている
  return (
    <div 
      className={styles["pagination"]}
      style={{ 
        "--btn-bg-color": buttonColor, 
        "--btn-hover-color": hoverColor 
      } as React.CSSProperties}
    >
      {/* 「最初」ボタン: 1ページ目にいるときは押せない */}
      <button
        className={styles["prev-button"]}
        disabled={currentPage === 1}
        onClick={handleFirstPage}
      >
        最初
      </button>
      {/* 「前」ボタン: 1ページ目にいるときは押せない */}
      <button
        className={styles["prev-button"]}
        disabled={currentPage === 1}
        onClick={handlePreviousPage}
      >
        前
      </button>
      {/* 現在のページ / 総ページ数（例: 2 / 5） */}
      <span>
        {currentPage} / {totalPages}
      </span>
      {/* 「次」ボタン: 最終ページにいるときは押せない */}
      <button
        className={styles["next-button"]}
        disabled={currentPage === totalPages}
        onClick={handleNextPage}
      >
        次
      </button>
      {/* 「最後」ボタン: 最終ページにいるときは押せない */}
      <button
        className={styles["next-button"]}
        disabled={currentPage === totalPages}
        onClick={handleLastPage}
      >
        最後
      </button>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default Pagination;