/**
 * ============================================================
 * ファイル名 : ShopSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : ショップ（所属部署）を選ぶプルダウン。
 *              選択肢は人員データ（models.py の member.shop）の選択肢と同じ13種類＋未選択。
 *
 * 主な機能   :
 *   - ショップの選択肢を表示し、選択が変わったら親コンポーネントに通知する
 *   - 人員登録・編集では入力欄として、一覧画面や班員登録画面などでは絞り込み条件として使う
 *
 * 使用箇所   : MemberPage/MemberNew.tsx（人員登録画面）, MemberPage/MemberEdit.tsx（人員編集画面）,
 *              MemberPage/MemberList.tsx（人員一覧画面）, TeamPage/TeamNew.tsx（班員登録画面）,
 *              TeamPage/TeamView.tsx（ショップ単位工数入力状況画面）,
 *              AdministratorPage/AdministratorKosuList.tsx（全工数管理画面）
 * 関連ファイル: styles/Components/ShopSelect.module.css
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";
import styles from "../styles/Components/ShopSelect.module.css";

// ============================================================
// 型定義
// ============================================================

/** ShopSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface ShopSelectProps {
  id?: string; // select要素の id 属性（label の htmlFor と対応させる。省略時は "shop"）
  value: string; // 現在選択されているショップ（"" なら未選択）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  name?: string; // select要素の name 属性（省略時は "shop"）
}

// ============================================================
// 定数
// ============================================================

// value と label を分けた選択肢リスト（現状はすべて value と label が同じ文字列）
// 組長以上は所属系統で2つに分かれる: (P,R,T,その他) 系 と (W,A) 系（組立系）
// 「異動・退社」は在籍していない人員に設定するショップ
const shopOptions = [
  { value: "", label: "---" }, // 未選択（一覧画面では「絞り込みなし」の意味になる）
  { value: "P", label: "P" },
  { value: "R", label: "R" },
  { value: "W1", label: "W1" },
  { value: "W2", label: "W2" },
  { value: "T1", label: "T1" },
  { value: "T2", label: "T2" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "J", label: "J" },
  { value: "その他", label: "その他" },
  { value: "組長以上(P,R,T,その他)", label: "組長以上(P,R,T,その他)" },
  { value: "組長以上(W,A)", label: "組長以上(W,A)" },
  { value: "異動・退社", label: "異動・退社" },
];

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * ショップを選ぶプルダウン。
 *
 * 選択中の値は親コンポーネントが state で管理し、value / onChange で受け渡す
 * （制御コンポーネント: 表示する値を React 側が握る作り）。この部品自身は state を持たない。
 * 幅などの見た目は ShopSelect.module.css の form-width クラスで決める。
 *
 * @param props - ShopSelectProps を参照
 * @returns ショップを選ぶ select 要素
 */
const ShopSelect: React.FC<ShopSelectProps> = ({
  value,
  onChange,
  // 以下2つは省略可能。省略されたときは右辺の値が使われる
  name = "shop",
  id = "shop",
}) => (
  <select id={id} name={name} value={value} onChange={onChange} className={styles["form-width"]}>
    {/* 選択肢を1件ずつ option 要素として表示（key には一意な value を使う） */}
    {shopOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// ============================================================
// エクスポート
// ============================================================
export default ShopSelect;