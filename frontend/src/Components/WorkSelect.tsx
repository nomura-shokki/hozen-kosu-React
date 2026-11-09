/**
 * ============================================================
 * ファイル名 : WorkSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 就業形態（出勤・休日出勤・年休 など）を選ぶプルダウン。
 *              mode により、出勤を伴う就業形態だけを出すか、休日・年休なども含めて全部出すかを切り替える。
 *
 * 主な機能   :
 *   - mode="LIMIT"（省略時）: 出勤を伴う就業形態のみ（工数を入力する日に選ぶもの）
 *   - mode="ALL"            : 上記に加えて休日・年休・公休・シフト休・代休・欠勤も選べる
 *   - disabled を指定すると選択できない状態にする
 *
 * 使用箇所   : KosuPage/KosuNew.tsx（工数入力画面。mode="LIMIT"）, KosuPage/KosuEdit.tsx（工数編集画面。mode="ALL"）,
 *              KosuPage/KosuCalendar.tsx（勤務入力画面。mode="ALL"）,
 *              AdministratorPage/AdministratorKosuList.tsx（全工数管理画面の絞り込み。mode="ALL"）,
 *              AdministratorPage/AdministratorKosuUpdate.tsx（全工数編集画面。mode="ALL"）
 * 関連ファイル: styles/Components/WorkSelect.module.css,
 *              Components/KosuDisplay.tsx（就業形態ごとの基準合計工数を表示する部品）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";
import styles from "../styles/Components/WorkSelect.module.css";

// ============================================================
// 型定義
// ============================================================

/** WorkSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface WorkSelectProps {
  id: string; // select要素の id 属性（label の htmlFor と対応させる）
  value: string; // 現在選択されている就業形態（"" なら未選択）
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
  disabled?: boolean; // true のとき選択不可（グレー表示）にする。省略時は選択可能
  mode?: "ALL" | "LIMIT"; // 選択肢の範囲。"ALL": 全就業形態 / "LIMIT": 出勤を伴う就業形態のみ（省略時）
}

// ============================================================
// 定数
// ============================================================

// 出勤を伴う就業形態の選択肢（mode="LIMIT" で使う。value と label は同じ文字列）
// 「(時短なし)」付きは、通常より基準時間が長い（例: 出勤 470分 → 出勤(時短なし) 480分）就業形態
const limitedWorkOptions = [
  { value: "", label: "---" }, // 未選択
  { value: "出勤", label: "出勤" },
  { value: "シフト出", label: "シフト出" },
  { value: "休出", label: "休出" }, // 休日出勤
  { value: "半前年休", label: "半前年休" }, // 前半の半日年休
  { value: "半後年休", label: "半後年休" }, // 後半の半日年休
  { value: "出勤(時短なし)", label: "出勤(時短なし)" },
  { value: "半前年休(時短なし)", label: "半前年休(時短なし)" },
  { value: "半後年休(時短なし)", label: "半後年休(時短なし)" },
  { value: "早退・遅刻", label: "早退・遅刻" },
];

// 全就業形態の選択肢（mode="ALL" で使う）: 上の一覧の後ろに、出勤しない就業形態を追加する
const allWorkOptions = [
  ...limitedWorkOptions,
  { value: "休日", label: "休日" },
  { value: "年休", label: "年休" },
  { value: "公休", label: "公休" },
  { value: "シフト休", label: "シフト休" },
  { value: "代休", label: "代休" },
  { value: "欠勤", label: "欠勤" },
];

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 就業形態を選ぶプルダウン。
 *
 * name 属性は工数データの項目名と同じ "work_time" に固定している
 * （親側で event.target.name を見てどの項目が変わったかを判断する画面があるため）。
 * 選択中の値は親コンポーネントが管理する（value / onChange を受け取る制御コンポーネント）。
 *
 * @param props - WorkSelectProps を参照
 * @returns 就業形態を選ぶ select 要素
 */
const WorkSelect: React.FC<WorkSelectProps> = ({ id, value, onChange, disabled, mode = "LIMIT" }) => {
  // mode に応じて表示する選択肢の一覧を切り替える
  const workOptions = mode === "ALL" ? allWorkOptions : limitedWorkOptions;

  // 就業形態のプルダウンを描画する
  return (
    <select
      id={id}
      name="work_time"
      value={value}
      className={styles["form-width"]}
      onChange={onChange}
      disabled={disabled}
    >
      {/* 選択肢を1件ずつ option 要素として表示（key には一意な value を使う） */}
      {workOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default WorkSelect;