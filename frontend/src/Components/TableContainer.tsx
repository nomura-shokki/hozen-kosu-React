/**
 * ============================================================
 * ファイル名 : TableContainer.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 一覧画面の表を囲む外枠。ブラウザの高さから見出し・検索欄の高さを引いた分を
 *              最大の高さにし、それを超える分は枠の中でスクロールさせる。
 *
 * 主な機能   :
 *   - 見出し・検索欄の実際の高さを測って、表の外枠の最大の高さを計算する
 *   - ブラウザのウィンドウサイズが変わったら計算し直す
 *   - heightExpansion を指定すると、見出し・検索欄を考慮せず「画面の高さ - 100px」にする
 *
 * 使用箇所   : KosuPage/KosuList.tsx（工数履歴一覧画面）, MemberPage/MemberList.tsx（人員一覧画面）,
 *              TeamPage/TeamList.tsx（班員工数履歴画面）, DefinitionPage/DefList.tsx（工数区分定義一覧画面）,
 *              DefinitionPage/DefDetailList.tsx（作業詳細選択肢一覧画面）, InquirPage/InquirList.tsx（問い合わせ履歴画面）,
 *              AdministratorPage/AdministratorKosuList.tsx（全工数管理画面。heightExpansion を指定）,
 *              AdministratorPage/AdministratorTaskList.tsx（非同期タスクデータ管理画面）,
 *              AdministratorPage/AdministratorHistoryList.tsx（データ操作履歴一覧画面）
 * 関連ファイル: styles/Components/TableContainer.module.css
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useRef, ReactNode } from "react";
import styles from "../styles/Components/TableContainer.module.css";

// ============================================================
// 型定義
// ============================================================

/** TableContainer が親コンポーネントから受け取る props（部品に渡す設定値） */
interface TableContainerProps {
    children: ReactNode; // 枠の中に表示する要素（表やページ切り替えボタンなど）
    searchBarRef: React.RefObject<HTMLElement | null>; // 親画面の検索欄の要素への参照（高さを測るのに使う）
    headerRef: React.RefObject<HTMLElement | null>; // 親画面の見出し（h1など）の要素への参照（高さを測るのに使う）
    heightExpansion?: boolean; // true: 最大の高さを「画面の高さ - 100px」にする / false（省略時）: 見出し・検索欄の高さを引く
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 高さを画面に合わせて自動調整する表の外枠。
 *
 * 親画面から見出し・検索欄の ref（DOM要素への参照）を受け取り、
 * 「ブラウザの表示領域の高さ - 検索欄の高さ - 見出しの高さ - 40px」を外枠の最大の高さにする。
 * 中身がそれより高い場合（行数が多い場合）は、外枠の中で縦スクロールする。
 *
 * @param props - TableContainerProps を参照
 * @returns 表の外枠のJSX
 */
const TableContainer: React.FC<TableContainerProps> = ({
    children,
    searchBarRef,
    headerRef,
    heightExpansion = false,
}) => {
    // ---------- state（画面の状態） ----------
    const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 外枠の最大の高さ（px）。初期値はブラウザ表示領域の高さ
    const containerRef = useRef<HTMLDivElement>(null); // 外枠の div 要素への参照（現状は付けているだけで、値の読み取りはしていない）

    // ---------- 副作用（useEffect） ----------

    // 表示時と、受け取った ref・heightExpansion が変わったとき:
    // 外枠の最大の高さを計算し、ウィンドウサイズ変更時にも計算し直すよう登録する
    useEffect(() => {
        /**
         * 外枠の最大の高さを計算して state に保存する。
         *
         * @returns なし（結果は maxHeight の state に反映）
         */
        const updateDimensions = () => {
            // 検索欄・見出しの実際の高さ（px）。要素がまだ無い場合は 0 とする
            const searchBarHeight = searchBarRef.current?.offsetHeight || 0;
            const headerHeight = headerRef.current?.offsetHeight || 0;

            if (heightExpansion) {
                // 拡張モード: 見出し・検索欄は考慮せず、画面の高さから一律100pxを引く
                setMaxHeight(window.innerHeight - 100);
            } else {
                // 通常: 画面の高さから検索欄・見出しの高さと余白40pxを引いた残りを表の高さにする
                setMaxHeight(
                    window.innerHeight - searchBarHeight - headerHeight - 40
                );
            }
        };

        // まず1回計算する
        updateDimensions();

        // ウィンドウサイズが変わるたびに計算し直す。画面から消えるとき（または再実行の前）に登録を解除する
        window.addEventListener("resize", updateDimensions);
        return () => {
            window.removeEventListener("resize", updateDimensions);
        };
    }, [searchBarRef, headerRef, heightExpansion]);

    // ---------- 描画（JSX） ----------

    // 計算した高さを最大値に設定し、はみ出した分は縦・横ともに枠の中でスクロールさせる
    return (
        <div
            ref={containerRef}
            className={styles["table-wrapper"]}
            style={{  
              maxHeight: `${maxHeight}px`,  
              overflowY: "auto",  
              overflowX: "auto",
            }}
        >
            {/* 親から渡された中身（表など）をそのまま表示 */}
            {children}
        </div>
    );
};

// ============================================================
// エクスポート
// ============================================================
export default TableContainer;