/**
 * ============================================================
 * ファイル名 : DefVersionSelect.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 工数区分定義Ver（作業カテゴリの定義セット）を選ぶプルダウン。
 *              選択肢の値には定義のID ではなく「定義名（kosu_name）」を使う。
 *
 * 主な機能   :
 *   - 親から受け取った工数区分定義Verの一覧を選択肢として表示する
 *   - 一覧が0件のときは「選択肢が取得できません」と表示する（選択不可）
 *
 * 使用箇所   : DefinitionPage/DefVer.tsx（工数区分定義切り替え画面）,
 *              AdministratorPage/AdministratorKosuUpdate.tsx（全工数編集画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { ChangeEvent } from "react";

// ============================================================
// 型定義
// ============================================================

/** DefVersionSelect が親コンポーネントから受け取る props（部品に渡す設定値） */
interface DefVersionSelectProps {
  id?: string; // select要素の id 属性。name 属性にも同じ値を使う（省略時は "versionchoice"）
  choices: { // 選択肢にする工数区分定義Verの一覧
    id: number; // 工数区分定義VerのID（主キー）。option の key に使う
    kosu_name: string; // 工数区分定義名。option の値と表示文字の両方に使う
  }[];
  selectedVersion: string; // 現在選択されている工数区分定義名（"" なら未選択）
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void; // 選択が変わったときに呼ばれる親側の関数
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義Verを選ぶプルダウン。
 *
 * 先頭に未選択用の「---」を置き、続けて choices の各定義名を並べる。
 * 選択中の値は親コンポーネントが管理する（value / onChange を受け取る制御コンポーネント）。
 *
 * @param props - DefVersionSelectProps を参照
 * @returns 工数区分定義Verを選ぶ select 要素
 */
const DefVersionSelect: React.FC<DefVersionSelectProps> = ({
  id = "versionchoice", // 省略時の id / name（工数区分定義切り替え画面は省略して使う）
  choices,
  selectedVersion,
  onChange, // PropsとしてonChangeを受け取る
}) => {
  // id と name に同じ値を設定した select 要素を描画する
  return (
    <select
      id={id}
      name={id}
      value={selectedVersion}
      onChange={onChange}
    >
      {/* 未選択を表す選択肢 */}
      <option value="">---</option>
      {/* 一覧が1件以上なら定義名を1件ずつ表示（key は定義のID）、0件なら選択不可の案内を表示 */}
      {choices.length > 0 ? (
        choices.map((choice) => (
          <option key={choice.id} value={choice.kosu_name}>
            {choice.kosu_name}
          </option>
        ))
      ) : (
        <option disabled>選択肢が取得できません</option>
      )}
    </select>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefVersionSelect;