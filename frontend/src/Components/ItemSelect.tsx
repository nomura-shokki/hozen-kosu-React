/**
 * ============================================================
 * ファイル名 : ItemSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 問い合わせの「内容」（要望 / 不具合 / 問い合わせ）を選ぶプルダウン。
 *              未選択時の表示は「-- 内容選択 --」。
 *
 * 主な機能   :
 *   - 問い合わせ内容の選択肢を表示し、選択が変わったら親コンポーネントに通知する
 *   - 問い合わせ登録・編集では入力欄として、問い合わせ履歴では絞り込み条件として使う
 *
 * 使用箇所   : InquirPage/InquirNew.tsx（問い合わせ画面）, InquirPage/InquirUpdate.tsx（問い合わせ編集画面）,
 *              InquirPage/InquirList.tsx（問い合わせ履歴画面）
 * 関連ファイル: Components/ContentSelect.tsx（選択肢が同じで、未選択時の表示だけが違う部品）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";

// ============================================================
// 型定義
// ============================================================

/** ItemSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface ItemSelectProps {
  value: string; // 現在選択されている値（"" / "要望" / "不具合" / "問い合わせ"）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  className?: string; // select要素に付けるCSSクラス名（省略時は "form-select"）
  name?: string; // select要素の name 属性（省略時は "Item"）
  id?: string; // select要素の id 属性（label の htmlFor と対応させる。省略時は "Item"）
}

// ============================================================
// 定数
// ============================================================

// プルダウンの選択肢一覧（value: 送信・保存される値 / label: 画面に表示する文字）
// 値は問い合わせデータ（models.py の inquiry_data.content_choice）の選択肢と同じ
const Options = [
  { value: "", label: "-- 内容選択 --" }, // 未選択（問い合わせ履歴では「絞り込みなし」の意味になる）
  { value: "要望", label: "要望" },
  { value: "不具合", label: "不具合" },
  { value: "問い合わせ", label: "問い合わせ" },
];

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 問い合わせ内容を選ぶプルダウン。
 *
 * 選択中の値は親コンポーネントが state で管理し、value / onChange で受け渡す
 * （制御コンポーネント: 表示する値を React 側が握る作り）。この部品自身は state を持たない。
 *
 * @param props - ItemSelectProps を参照
 * @returns 問い合わせ内容を選ぶ select 要素
 */
const ItemSelect: React.FC<ItemSelectProps> = ({
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
export default ItemSelect;