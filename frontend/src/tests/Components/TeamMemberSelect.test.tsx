/**
 * ============================================================
 * ファイル名 : TeamMemberSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/TeamMemberSelect.tsx（人員を1人選ぶプルダウン部品）
 * 概要       : 未選択用の「-- 人員選択 --」と、渡した人員が「従業員番号 - 氏名」の形で表示されること、
 *              人員一覧が空のときは未選択用の選択肢だけになること、変更時に onChange が呼ばれることを確認する。
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
import TeamMemberSelect from "../../Components/TeamMemberSelect";

// ============================================================
// テスト本体
// ============================================================

// TeamMemberSelect 部品の選択肢表示と変更通知を確認するテストグループ
describe("TeamMemberSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange（呼び出し履歴を記録する）
  const mockOnChange = vi.fn();

  // 選択肢にする人員の一覧の例（従業員番号と氏名）
  const options = [
    { employee_no: 101, name: "田中太郎" },
    { employee_no: 202, name: "鈴木次郎" },
  ];

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】未選択用の選択肢と、人員が「従業員番号 - 氏名」の形で表示されること
  //   前提: 人員2人（101 田中太郎 / 202 鈴木次郎）を渡す
  //   操作: 部品を表示する
  //   期待: 「-- 人員選択 --」「101 - 田中太郎」「202 - 鈴木次郎」が表示され、option がちょうど3個ある
  it("'-- 人員選択 --' とメンバーオプションが 'employee_no - name' 形式で表示されること", () => {
    // 操作: 部品を表示
    render(
      <TeamMemberSelect name="member" value="" onChange={mockOnChange} options={options} />
    );
    // 検証: 未選択用の選択肢と各人員の表示がある
    expect(screen.getByText("-- 人員選択 --")).toBeInTheDocument();
    expect(screen.getByText("101 - 田中太郎")).toBeInTheDocument();
    expect(screen.getByText("202 - 鈴木次郎")).toBeInTheDocument();
    // 検証: option の数は未選択用1個 + 人員2人 = 3個
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  // 【テスト】人員一覧が空のときは未選択用の選択肢だけになること
  //   前提: options に空配列を渡す
  //   操作: 部品を表示する
  //   期待: 「-- 人員選択 --」が表示され、option は1個だけ
  it("空のoptions配列の場合、プレースホルダーのみ表示されること", () => {
    // 操作: 空の人員一覧で部品を表示
    render(
      <TeamMemberSelect name="member" value="" onChange={mockOnChange} options={[]} />
    );
    // 検証: 未選択用（プレースホルダー＝入力前の案内表示）の選択肢だけがある
    expect(screen.getByText("-- 人員選択 --")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  // 【テスト】選択を変更すると onChange が呼ばれること
  //   前提: 人員2人を渡す
  //   操作: プルダウンで従業員番号 101 を選ぶ
  //   期待: mockOnChange が呼ばれる
  it("選択変更時に onChange が呼ばれること", () => {
    // 準備: 部品を表示
    render(
      <TeamMemberSelect name="member" value="" onChange={mockOnChange} options={options} />
    );
    // 操作: プルダウン（combobox）で値 "101"（田中太郎）を選ぶ
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "101" } });
    // 検証: 親に変更が通知される
    expect(mockOnChange).toHaveBeenCalled();
  });
});
