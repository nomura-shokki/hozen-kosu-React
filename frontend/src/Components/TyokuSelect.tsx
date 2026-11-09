/**
 * ============================================================
 * ファイル名 : TyokuSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 直（勤務シフト）を選ぶプルダウン。
 *              画面には「1直」「常昼」などの名称を表示し、値には直の番号（"1"〜"6"）を使う。
 *
 * 主な機能   :
 *   - 直の選択肢を表示し、選択が変わったら親コンポーネントに通知する
 *   - disabled を指定すると選択できない状態にする
 *
 * 使用箇所   : KosuPage/KosuNew.tsx（工数入力画面）, KosuPage/KosuEdit.tsx（工数編集画面）,
 *              KosuPage/KosuCalendar.tsx（勤務入力画面）, AdministratorPage/AdministratorKosuList.tsx（全工数管理画面の絞り込み）,
 *              AdministratorPage/AdministratorKosuUpdate.tsx（全工数編集画面）
 * 関連ファイル: styles/Components/TyokuSelect.module.css
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";
import styles from "../styles/Components/TyokuSelect.module.css";

// ============================================================
// 型定義
// ============================================================

/** TyokuSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface TyokuSelectProps {
  id: string; // select要素の id 属性（label の htmlFor と対応させる）
  value: string; // 現在選択されている直の番号（"1"〜"6"。"" なら未選択）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  disabled?: boolean; // true のとき選択不可（グレー表示）にする。省略時は選択可能
}

// ============================================================
// 定数
// ============================================================

// プルダウンの選択肢一覧（value: 保存される直の番号 / label: 画面に表示する直の名称）
// 番号の意味: 1=1直 / 2=2直 / 3=3直 / 4=常昼 / 5=連1直 / 6=連2直
// （5・6 はこの部品では「1直(連2)」「2直(連2)」と表示する）
const tyokuOptions = [
  { value: "", label: "---" }, // 未選択
  { value: "1", label: "1直" },
  { value: "2", label: "2直" },
  { value: "3", label: "3直" },
  { value: "4", label: "常昼" },
  { value: "5", label: "1直(連2)" },
  { value: "6", label: "2直(連2)" },
];

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 直を選ぶプルダウン。
 *
 * name 属性は工数データの項目名と同じ "tyoku2" に固定している
 * （親側で event.target.name を見てどの項目が変わったかを判断する画面があるため）。
 * 選択中の値は親コンポーネントが管理する（value / onChange を受け取る制御コンポーネント）。
 *
 * @param props - TyokuSelectProps を参照
 * @returns 直を選ぶ select 要素
 */
const TyokuSelect: React.FC<TyokuSelectProps> = ({ id, value, onChange, disabled }) => (
  <select 
    id={id}
    name="tyoku2" 
    value={value} 
    className={styles["form-width"]} 
    onChange={onChange}
    disabled={disabled}
  >
    {/* 選択肢を1件ずつ option 要素として表示（key には一意な value を使う） */}
    {tyokuOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// ============================================================
// エクスポート
// ============================================================
export default TyokuSelect;