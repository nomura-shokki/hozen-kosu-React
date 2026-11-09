/**
 * ============================================================
 * ファイル名 : DefSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 工数入力時に「どの工数区分（作業カテゴリ）の作業をしたか」を選ぶプルダウン。
 *              選択中の工数区分定義Verに登録されている工数区分名と、固定の「休憩」を並べる。
 *
 * 主な機能   :
 *   - 工数区分定義データ（kosu_title_1〜50）から選択肢を自動生成する
 *   - 各選択肢の値は、作業内容（time_work）に書き込む1文字の記号（A〜Z, a〜x, 休憩は "$"）
 *
 * 使用箇所   : KosuPage/KosuNew.tsx（工数入力画面）, KosuPage/KosuEdit.tsx（工数編集画面）
 * 関連ファイル: Components/KosuDisplay.tsx, Components/KosuBarChart.tsx（同じ記号を読み取って表示する部品）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";

// ============================================================
// 型定義
// ============================================================

/** DefSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface DefSelectProps {
  value: string; // セレクトボックスの現在の選択値（工数区分の記号1文字、"$"=休憩、""=未選択）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 値変更時に呼ばれる親側の関数
  defData: { [key: string]: string | undefined }; // 工数区分定義データ（キー "kosu_title_1"〜"kosu_title_50" に工数区分名が入る）
  className?: string; // select要素に付けるCSSクラス名（省略時は "form-select"）
  name?: string; // セレクトボックスのname属性（省略時は "time_work"）
  id?: string; // セレクトボックスのid属性（省略時は "time_work"）
  disabled?: boolean; // true のとき選択不可（グレー表示）にする。省略時は false
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分を選ぶプルダウン。
 *
 * 工数区分定義データの kosu_title_1, kosu_title_2, … を順番に記号 A, B, … へ対応させ、
 * 工数区分名が空でないものだけを選択肢にする。最後に固定の「休憩」（値 "$"）を加える。
 * 選択中の値は親コンポーネントが管理する（value / onChange を受け取る制御コンポーネント）。
 *
 * @param props - DefSelectProps を参照
 * @returns 工数区分を選ぶ select 要素
 */
const DefSelect: React.FC<DefSelectProps> = ({
  value,
  onChange,
  defData,
  className = "form-select", // classNameのデフォルト値を設定（※このプロジェクトのCSSには form-select の定義はない）
  name = "time_work", // name属性のデフォルト値を設定
  id = "time_work", // id属性のデフォルト値を設定
  disabled = false, // disabled のデフォルト値を設定（通常は選択可能）
}) => {
  // 工数区分に割り当てる記号の一覧（大文字26文字 + 小文字24文字 = 最大50区分ぶん）
  // 1番目の工数区分 → "A"、26番目 → "Z"、27番目 → "a"、50番目 → "x" に対応する
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";

  // defDataオブジェクトのキーから"kosu_title_"で始まるものを取り出し、
  // それに対応するラベル（工数区分名）と記号を組にしてオプションリストを生成する。
  // 記号は空欄を除く前の並び順で割り当てるため、途中に空欄の工数区分があっても
  // 「kosu_title_N の記号」は常に同じになる（例: kosu_title_3 は必ず "C"）
  const defOptions = Object.keys(defData)
    .filter((key) => key.startsWith("kosu_title_")) // キーが"kosu_title_"で始まるもののみ取得
    .map((key, index) => ({
      value: alphabet[index], // 並び順に応じて記号を設定（0番目 → "A"）
      label: defData[key] || "", // データが存在しない場合は空文字に
    }))
    .filter(({ label }) => label !== ""); // 工数区分名が登録されているもののみ残す

  // オプションリストの末尾に固定値として「休憩」を追加する（作業内容では "$" が休憩を表す）
  defOptions.push({ value: "$", label: "休憩" });

  // セレクトボックスを描画する（先頭は未選択用の「---」）
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className={className}
      disabled={disabled}
    >
      {/* 未選択を表す選択肢 */}
      <option value="">---</option>
      {/* 工数区分（と休憩）を1件ずつ表示（key には一意な記号を使う） */}
      {defOptions.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefSelect; // このコンポーネントをエクスポートして外部で利用可能にする