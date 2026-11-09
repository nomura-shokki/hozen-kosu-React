/**
 * ============================================================
 * ファイル名 : JudgementSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/JudgementSelect.tsx（工数入力OK/NG判定を選ぶプルダウン部品）
 * 概要       : 選択肢（--- / OK / NG）がすべて表示されることと、
 *              選択を変えたときに親から渡された onChange が呼ばれることを確認する。
 *
 * モック方針 :
 *   - onChange（親から渡す関数）: 偽の関数 vi.fn() を渡し、呼ばれたかどうかを確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import JudgementSelect from "../../Components/JudgementSelect";

// ============================================================
// テスト本体
// ============================================================

// JudgementSelect 部品の選択肢表示と変更通知を確認するテストグループ
describe("JudgementSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange（呼び出し履歴を記録する）
  const mockOnChange = vi.fn();

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】工数入力OK/NG判定の選択肢がすべて表示されること
  //   前提: value は ""（指定なし）
  //   操作: 部品を表示する
  //   期待: 「---」「OK」「NG」が表示され、option がちょうど3個ある
  it("全ての選択肢が表示されること", () => {
    // 準備: 部品を表示
    render(<JudgementSelect value="" onChange={mockOnChange} />);
    // 検証: 期待する選択肢の文字を1つずつ確認する
    const expectedLabels = ["---", "OK", "NG"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // 検証: 余分な選択肢が無い（option 要素が3個）
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  // 【テスト】選択を変更すると onChange が呼ばれること
  //   前提: value は ""（指定なし）
  //   操作: プルダウンで「OK」を選ぶ
  //   期待: mockOnChange が呼ばれる
  it("選択変更時に onChange が呼ばれること", () => {
    // 準備: 部品を表示
    render(<JudgementSelect value="" onChange={mockOnChange} />);
    // 操作: プルダウン（combobox）で「OK」を選ぶ
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "OK" } });
    // 検証: 親に変更が通知される
    expect(mockOnChange).toHaveBeenCalled();
  });
});
