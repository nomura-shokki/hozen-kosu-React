/**
 * ============================================================
 * ファイル名 : ContentSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 問い合わせの「内容」（要望 / 不具合 / 問い合わせ）を選ぶ
 *              プルダウン（select要素）。未選択時の表示は「---」。
 *
 * 主な機能   :
 *   - 問い合わせ内容の選択肢を表示し、選択が変わったら親コンポーネントに通知する
 *
 * 使用箇所   : 現在どの画面からも使われていない（tests/Components/ContentSelect.test.tsx のみ）。
 *              問い合わせ画面では、同じ選択肢を持つ Components/ItemSelect.tsx が使われている
 * 関連ファイル: Components/ItemSelect.tsx（選択肢が同じ部品）
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
 * ContentSelect が親コンポーネントから受け取る props（部品に渡す設定値）。
 *
 * ※名前は ShopSelectProps だが、Components/ShopSelect.tsx の型とは別物で、
 *   このファイルの中だけで使われる。
 */
interface ShopSelectProps {
  value: string; // 現在選択されている値（"" / "要望" / "不具合" / "問い合わせ"）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  className?: string; // select要素に付けるCSSクラス名（省略時は "form-select"）
  name?: string; // select要素の name 属性（省略時は "content"）
  id?: string; // select要素の id 属性（label の htmlFor と対応させる。省略時は "content"）
}

// ============================================================
// 定数
// ============================================================

// プルダウンの選択肢一覧（value: 送信・保存される値 / label: 画面に表示する文字）
// 値は問い合わせデータ（models.py の inquiry_data.content_choice）の選択肢と同じ
const contentOptions = [
  { value: "", label: "---" }, // 未選択
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
 * @param props - ShopSelectProps を参照
 * @returns 問い合わせ内容を選ぶ select 要素
 */
const ContentSelect: React.FC<ShopSelectProps> = ({
  value,
  onChange,
  // 以下3つは省略可能。省略されたときは右辺の値が使われる
  className = "form-select", // ※このプロジェクトのCSSには form-select の定義はない
  name = "content",
  id = "content",
}) => (
  <select id={id} name={name} value={value} onChange={onChange} className={className}>
    {/* 選択肢を1件ずつ option 要素として表示（key には一意な value を使う） */}
    {contentOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// ============================================================
// エクスポート
// ============================================================
export default ContentSelect;