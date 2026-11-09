/**
 * ============================================================
 * ファイル名 : TyokuSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/TyokuSelect.tsx（直（勤務シフト）を選ぶプルダウン部品）
 * 概要       : 直の選択肢（--- / 1直 / 2直 / 3直 / 常昼 / 1直(連2) / 2直(連2)）がすべて表示されることと、
 *              disabled を渡すと選択不可になることを確認する。
 *
 * モック方針 :
 *   - styles/Components/TyokuSelect.module.css : CSS Modules のクラス名を固定の文字列にして単純化するため
 *   - onChange（親から渡す関数）: 偽の関数 vi.fn() を渡すため（このファイルでは呼び出しは確認しない）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import TyokuSelect from "../../Components/TyokuSelect";

// ============================================================
// モック定義
// ============================================================

// CSS Modules のモック: styles["form-width"] が "form-width" をそのまま返すようにする
vi.mock("../../styles/Components/TyokuSelect.module.css", () => ({
  default: { "form-width": "form-width" },
}));

// ============================================================
// テスト本体
// ============================================================

// TyokuSelect 部品の選択肢表示と無効化を確認するテストグループ
describe("TyokuSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange
  const mockOnChange = vi.fn();

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】直の選択肢がすべて表示されること
  //   前提: value は ""（未選択）
  //   操作: 部品を表示する
  //   期待: 「---」と6種類の直の名称が表示され、option がちょうど7個ある
  it("全ての選択肢が表示されること", () => {
    // 準備: 部品を表示（id は必須の props）
    render(<TyokuSelect id="tyoku" value="" onChange={mockOnChange} />);
    // 検証: 期待する選択肢の文字を1つずつ確認する（値 "5"/"6" の連1直・連2直は「1直(連2)」「2直(連2)」と表示される）
    const expectedLabels = ["---", "1直", "2直", "3直", "常昼", "1直(連2)", "2直(連2)"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // 検証: 余分な選択肢が無い（option 要素が7個）
    expect(screen.getAllByRole("option")).toHaveLength(7);
  });

  // 【テスト】disabled=true を渡すとプルダウンが選択不可になること
  //   前提: disabled に true を渡す
  //   操作: 部品を表示する
  //   期待: プルダウンが無効（disabled）状態である
  it("disabled プロパティが機能すること", () => {
    // 準備: disabled 付きで部品を表示し、プルダウン（combobox）を取得
    render(<TyokuSelect id="tyoku" value="" onChange={mockOnChange} disabled={true} />);
    const select = screen.getByRole("combobox");
    // 検証: プルダウンが無効化されている
    expect(select).toBeDisabled();
  });
});
