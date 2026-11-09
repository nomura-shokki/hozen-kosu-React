/**
 * ============================================================
 * ファイル名 : DefTable.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 工数区分名と色の対応表（凡例）を表示する部品。
 *              工数グラフ（KosuBarChart）の棒の色が、どの工数区分を表すかを示す。
 *
 * 主な機能   :
 *   - 工数区分定義データから登録済みの工数区分名を取り出して一覧表示する
 *   - 各工数区分名の横に、グラフと同じ色の丸印を表示する
 *
 * 使用箇所   : KosuPage/KosuNew.tsx（工数入力画面）, KosuPage/KosuEdit.tsx（工数編集画面）,
 *              KosuPage/KosuDelete.tsx（工数削除画面）, TeamPage/TeamDetail.tsx（班員工数履歴詳細画面）
 * 関連ファイル: styles/Components/DefTable.module.css,
 *              Components/KosuBarChart.tsx（同じ色の作り方でグラフを塗る部品）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";
import styles from "../styles/Components/DefTable.module.css";

// ============================================================
// 型定義
// ============================================================

/** DefTable が親コンポーネントから受け取る props（部品に渡す設定値） */
interface DefDataProps {
  defData: { [key: string]: string | undefined }; // 工数区分定義データ（キー "kosu_title_1"〜"kosu_title_50" に工数区分名が入る）
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 工数区分ごとの表示色を50色ぶん作る。
 *
 * 色相（hue: 色の種類を0〜360度の角度で表す値）を7度ずつずらした HSL 形式の色を並べる。
 * 彩度70%・明度50%は固定。KosuBarChart.tsx の同名関数と同じ計算にして、
 * グラフの棒の色とこの凡例の色をそろえている。
 *
 * @returns 色文字列の配列（例: ["hsl(0, 70%, 50%)", "hsl(7, 70%, 50%)", …] の50要素）
 */
const generateColorPalette = (): string[] => {
  const colors = [];
  // 360度を50色で分けた間隔（360 / 50 = 7.2 を切り捨てて 7度）
  const step = Math.floor(360 / 50);
  // 工数区分の最大数（50区分）ぶんの色を作る
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * step) % 360}, 70%, 50%)`);
  }
  return colors;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分の凡例（工数区分名 + 色の丸印）を一覧表示する。
 *
 * 工数区分名が空でない kosu_title_N だけを取り出し、取り出した順番に
 * 色パレットの色を割り当てる。
 * ※KosuBarChart.tsx は作業内容の記号（A=1番目, B=2番目, …）から色を決めるため、
 *   途中に空欄の工数区分がある場合や27番目以降の工数区分では、凡例とグラフの色が一致しないことがある。
 *
 * @param props - DefDataProps を参照
 * @returns 凡例一覧のJSX
 */
const DefTable: React.FC<DefDataProps> = ({ defData }) => {
  // 50色の色パレットを用意する
  const colorPalette = generateColorPalette();

  // "kosu_title_" で始まり、かつ工数区分名が入っているキーだけを取り出し、
  // 「工数区分名」と「色」の組の配列にする（色は空欄を除いた後の並び順で割り当てる）
  const titles = Object.keys(defData)
    .filter((key) => key.startsWith("kosu_title_") && defData[key])
    .map((key, index) => ({
      title: defData[key]!, // 直前の filter で空でないことを確認済みのため「!」で undefined でないと明示する
      color: colorPalette[index],
    }));

  // 凡例一覧を描画する
  return (
    <div className={styles.chartDataList}>
      {/* 工数区分1件につき1行（名前 + 色の丸印）を表示（key には並び順の番号を使う） */}
      {titles.map((item, index) => (
        <div key={index} className={styles.dataListItem}>
          {/* 工数区分名 */}
          <span className={styles.itemLabel}>{item.title}</span>
          {/* 色の丸印: 直径14pxの円（borderRadius 50% で四角を丸くする）を工数区分の色で塗る */}
          <span
            className={styles["color-dot"]}
            style={{
              backgroundColor: item.color,
              display: "inline-block",
              borderRadius: "50%",
              width: "14px",
              height: "14px",
            }}
          />
        </div>
      ))}
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefTable;