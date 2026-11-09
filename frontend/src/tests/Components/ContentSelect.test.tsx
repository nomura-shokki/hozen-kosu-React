/**
 * ============================================================
 * ファイル名 : ContentSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/ContentSelect.tsx（問い合わせ内容を選ぶプルダウン部品）
 * 概要       : 選択肢（--- / 要望 / 不具合 / 問い合わせ）がすべて表示されることと、
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
import ContentSelect from "../../Components/ContentSelect";

// ============================================================
// テスト本体
// ============================================================

// ContentSelect 部品の選択肢表示と変更通知を確認するテストグループ
describe("ContentSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange（呼び出し履歴を記録する）
  const mockOnChange = vi.fn();

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】問い合わせ内容の選択肢がすべて表示されること
  //   前提: value は ""（未選択）
  //   操作: 部品を表示する
  //   期待: 「---」「要望」「不具合」「問い合わせ」が表示され、option がちょうど4個ある
  it("全ての選択肢が表示されること", () => {
    // 準備: 部品を表示
    render(<ContentSelect value="" onChange={mockOnChange} />);
    // 検証: 期待する選択肢の文字を1つずつ確認する
    const expectedLabels = ["---", "要望", "不具合", "問い合わせ"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // 検証: 余分な選択肢が無い（option 要素が4個）
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  // 【テスト】選択を変更すると onChange が呼ばれること
  //   前提: value は ""（未選択）
  //   操作: プルダウンで「要望」を選ぶ
  //   期待: mockOnChange が呼ばれる
  it("選択変更時に onChange が呼ばれること", () => {
    // 準備: 部品を表示し、プルダウン（combobox）を取得
    render(<ContentSelect value="" onChange={mockOnChange} />);
    const select = screen.getByRole("combobox");
    // 操作: 「要望」を選ぶ
    fireEvent.change(select, { target: { value: "要望" } });
    // 検証: 親に変更が通知される
    expect(mockOnChange).toHaveBeenCalled();
  });
});
