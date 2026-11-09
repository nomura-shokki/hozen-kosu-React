/**
 * ============================================================
 * ファイル名 : ShopSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/ShopSelect.tsx（ショップ（所属部署）を選ぶプルダウン部品）
 * 概要       : ショップの選択肢（未選択＋13種類）がすべて表示されることと、
 *              選択を変えたときに親から渡された onChange が呼ばれることを確認する。
 *
 * モック方針 :
 *   - styles/Components/ShopSelect.module.css : CSS Modules のクラス名を固定の文字列にして単純化するため
 *   - onChange（親から渡す関数）: 偽の関数 vi.fn() を渡し、呼ばれたかどうかを確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import ShopSelect from "../../Components/ShopSelect";

// ============================================================
// モック定義
// ============================================================

// CSS Modules のモック: styles["form-width"] が "form-width" をそのまま返すようにする
vi.mock("../../styles/Components/ShopSelect.module.css", () => ({
  default: { "form-width": "form-width" },
}));

// ============================================================
// テスト本体
// ============================================================

// ShopSelect 部品の選択肢表示と変更通知を確認するテストグループ
describe("ShopSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange（呼び出し履歴を記録する）
  const mockOnChange = vi.fn();

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】ショップの選択肢がすべて表示されること
  //   前提: value は ""（未選択）
  //   操作: 部品を表示する
  //   期待: 「---」と13種類のショップ名がすべて表示され、option がちょうど14個ある
  it("全ての選択肢が表示されること", () => {
    // 準備: 部品を表示
    render(<ShopSelect value="" onChange={mockOnChange} />);
    // 検証: 期待する選択肢の文字（未選択 + 人員データのショップ選択肢13種類）を1つずつ確認する
    const expectedLabels = [
      "---", "P", "R", "W1", "W2", "T1", "T2", "A1", "A2", "J",
      "その他", "組長以上(P,R,T,その他)", "組長以上(W,A)", "異動・退社",
    ];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // 検証: 余分な選択肢が無い（option 要素が14個）
    expect(screen.getAllByRole("option")).toHaveLength(14);
  });

  // 【テスト】選択を変更すると onChange が呼ばれること
  //   前提: value は ""（未選択）
  //   操作: プルダウンで「P」を選ぶ
  //   期待: mockOnChange が呼ばれる
  it("選択変更時に onChange が呼ばれること", () => {
    // 準備: 部品を表示し、プルダウン（combobox）を取得
    render(<ShopSelect value="" onChange={mockOnChange} />);
    const select = screen.getByRole("combobox");
    // 操作: 「P」を選ぶ
    fireEvent.change(select, { target: { value: "P" } });
    // 検証: 親に変更が通知される
    expect(mockOnChange).toHaveBeenCalled();
  });
});
