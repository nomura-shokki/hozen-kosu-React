/**
 * ============================================================
 * ファイル名 : TeamMemberSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 人員を1人選ぶプルダウン。選択肢は「従業員番号 - 氏名」の形で表示する。
 *              選択肢の一覧は親コンポーネントから受け取る（画面ごとに班員・問い合わせ者・全人員など中身が違う）。
 *
 * 主な機能   :
 *   - 親から受け取った人員一覧を選択肢として表示し、選択が変わったら親に通知する
 *   - 選択肢の値には従業員番号を使う
 *
 * 使用箇所   : TeamPage/TeamNew.tsx（班員登録画面のメンバー選択）, TeamPage/TeamList.tsx（班員工数履歴画面の絞り込み）,
 *              InquirPage/InquirList.tsx（問い合わせ履歴画面の問い合わせ者絞り込み）,
 *              AdministratorPage/AdministratorKosuList.tsx（全工数管理画面の人員絞り込み）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { ChangeEvent } from "react";

// ============================================================
// 型定義
// ============================================================

/** TeamMemberSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface TeamMemberSelectProps {
  id?: string; // select要素の id 属性（label の htmlFor と対応させる）。省略可
  name: string; // select要素の name 属性
  value: string; // 現在選択されている従業員番号（文字列。"" なら未選択）
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  options: { employee_no: number; name: string }[]; // 選択肢にする人員の一覧（従業員番号と氏名）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 人員を選ぶプルダウン。
 *
 * 先頭に未選択用の「-- 人員選択 --」を置き、続けて options の人員を並べる。
 * 選択中の値は親コンポーネントが管理する（value / onChange を受け取る制御コンポーネント）。
 *
 * @param props - TeamMemberSelectProps を参照
 * @returns 人員を選ぶ select 要素
 */
const TeamMemberSelect: React.FC<TeamMemberSelectProps> = ({ id, name, value, onChange, options }) => {
  // 人員選択のプルダウンを描画する
  return (
    <select id={id} name={name} value={value} onChange={onChange}>
      {/* 未選択を表す選択肢（絞り込みに使う画面では「指定なし」の意味になる） */}
      <option value="">-- 人員選択 --</option>
      {/* 人員1人につき1つの選択肢を表示（値・key は従業員番号、表示は「従業員番号 - 氏名」） */}
      {options.map((option) => (
        <option key={option.employee_no} value={option.employee_no}>
          {option.employee_no} - {option.name}
        </option>
      ))}
    </select>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default TeamMemberSelect;