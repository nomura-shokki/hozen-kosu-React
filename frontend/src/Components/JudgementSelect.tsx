/**
 * ============================================================
 * ファイル名 : JudgementSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 工数入力OK/NG判定（入力内容に不整合がないか）で絞り込むためのプルダウン。
 *              選択肢は「---（指定なし）」「OK」「NG」の3つ。
 *
 * 主な機能   :
 *   - OK / NG の選択肢を表示し、選択が変わったら親コンポーネントに通知する
 *
 * 使用箇所   : AdministratorPage/AdministratorKosuList.tsx（全工数管理画面の検索欄）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";

// ============================================================
// 型定義
// ============================================================

/**
 * JudgementSelect が親コンポーネントから受け取る props（部品に渡す設定値）。
 *
 * ※名前は ItemSelectProps だが、Components/ItemSelect.tsx の型とは別物で、
 *   このファイルの中だけで使われる。
 */
interface ItemSelectProps {
  value: string; // 現在選択されている値（"" / "OK" / "NG"）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  className?: string; // select要素に付けるCSSクラス名（省略時は "form-select"）
  name?: string; // select要素の name 属性（省略時は "Item"）
  id?: string; // select要素の id 属性（label の htmlFor と対応させる。省略時は "Item"）
}

// ============================================================
// 定数
// ============================================================

// プルダウンの選択肢一覧（value: 親に渡る値 / label: 画面に表示する文字）
const Options = [
  { value: "", label: "---" }, // 指定なし（OK・NGどちらも対象）
  { value: "OK", label: "OK" }, // 工数入力OK/NG判定が OK のもの
  { value: "NG", label: "NG" }, // 工数入力OK/NG判定が NG のもの
];

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数入力OK/NG判定を選ぶプルダウン。
 *
 * 選択中の値は親コンポーネントが state で管理し、value / onChange で受け渡す
 * （制御コンポーネント: 表示する値を React 側が握る作り）。この部品自身は state を持たない。
 *
 * @param props - ItemSelectProps を参照
 * @returns 工数入力OK/NG判定を選ぶ select 要素
 */
const JudgementSelect: React.FC<ItemSelectProps> = ({
  value,
  onChange,
  // 以下3つは省略可能。省略されたときは右辺の値が使われる
  className = "form-select", // ※このプロジェクトのCSSには form-select の定義はない
  name = "Item",
  id = "Item",
}) => (
  <select id={id} name={name} value={value} onChange={onChange} className={className}>
    {/* 選択肢を1件ずつ option 要素として表示（key には一意な value を使う） */}
    {Options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// ============================================================
// エクスポート
// ============================================================
export default JudgementSelect;