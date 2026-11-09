/**
 * ============================================================
 * ファイル名 : DefVersionSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/DefVersionSelect.tsx（工数区分定義Verを選ぶプルダウン部品）
 * 概要       : 渡した工数区分定義Verの一覧が選択肢として表示されることと、
 *              一覧が空のときに「選択肢が取得できません」と表示されることを確認する。
 *
 * モック方針 :
 *   - onChange（親から渡す関数）: 偽の関数 vi.fn() を渡すため（このファイルでは呼び出しは確認しない）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import DefVersionSelect from "../../Components/DefVersionSelect";

// ============================================================
// テスト本体
// ============================================================

// DefVersionSelect 部品の選択肢表示を確認するテストグループ
describe("DefVersionSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange
  const mockOnChange = vi.fn();

  // 工数区分定義Verの一覧の例（id: 定義のID / kosu_name: 定義名）
  const choices = [
    { id: 1, kosu_name: "Version1" },
    { id: 2, kosu_name: "Version2" },
  ];

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】未選択用の「---」と、渡した定義名が選択肢として表示されること
  //   前提: 定義名 Version1 / Version2 の2件を渡す
  //   操作: 部品を表示する
  //   期待: 「---」「Version1」「Version2」が表示され、option がちょうど3個ある
  it("--- と choices の選択肢が表示されること", () => {
    // 準備: 部品を表示
    render(
      <DefVersionSelect choices={choices} selectedVersion="" onChange={mockOnChange} />
    );
    // 検証: 各選択肢の文字があり、option の数は「---」＋2件 = 3個
    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("Version1")).toBeInTheDocument();
    expect(screen.getByText("Version2")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  // 【テスト】一覧が空のときは「選択肢が取得できません」と表示されること
  //   前提: choices に空配列を渡す
  //   操作: 部品を表示する
  //   期待: 「選択肢が取得できません」が表示される
  it("choices が空のとき '選択肢が取得できません' が表示されること", () => {
    // 準備: 空の一覧で部品を表示
    render(
      <DefVersionSelect choices={[]} selectedVersion="" onChange={mockOnChange} />
    );
    // 検証: 案内用の（選べない）選択肢が表示される
    expect(screen.getByText("選択肢が取得できません")).toBeInTheDocument();
  });
});
