/**
 * ============================================================
 * ファイル名 : WorkSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/WorkSelect.tsx（就業形態を選ぶプルダウン部品）
 * 概要       : mode="LIMIT"（省略時）と mode="ALL" それぞれで表示される就業形態の選択肢、
 *              disabled 指定時の無効化、選択変更時に onChange が呼ばれることを確認する。
 *              ※選択肢には「出勤(時短なし)」「半前年休(時短なし)」「半後年休(時短なし)」の3項目も含まれるため、
 *                選択肢の個数は LIMIT が10個、ALL が16個になる。
 *
 * モック方針 :
 *   - styles/Components/WorkSelect.module.css : CSS Modules のクラス名を固定の文字列にして単純化するため
 *   - onChange（親から渡す関数）              : 偽の関数 vi.fn() を渡し、呼ばれたかどうかを確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import WorkSelect from "../../Components/WorkSelect";

// ============================================================
// モック定義
// ============================================================

// CSS Modules のモック: styles["form-width"] が "form-width" をそのまま返すようにする
vi.mock("../../styles/Components/WorkSelect.module.css", () => ({
  default: { "form-width": "form-width" },
}));

// ============================================================
// テスト本体
// ============================================================

// WorkSelect 部品の選択肢表示・無効化・変更通知を確認するテストグループ
describe("WorkSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange（呼び出し履歴を記録する）
  const mockOnChange = vi.fn();

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】mode 省略時（LIMIT）は出勤を伴う就業形態だけが表示されること
  //   前提: mode を渡さない（"LIMIT" 扱い）
  //   操作: 部品を表示する
  //   期待: 「---」「出勤」「シフト出」「休出」「半前年休」「半後年休」「早退・遅刻」と
  //         「(時短なし)」の3項目が表示され、option がちょうど10個ある
  it("デフォルト(LIMIT)モードで限定された選択肢が表示されること", () => {
    // 操作: mode を省略して部品を表示
    render(<WorkSelect id="work" value="" onChange={mockOnChange} />);
    // 検証: 出勤を伴う就業形態の選択肢を1つずつ確認する
    const limitLabels = [
      "---", "出勤", "シフト出", "休出", "半前年休", "半後年休", "早退・遅刻",
      "出勤(時短なし)", "半前年休(時短なし)", "半後年休(時短なし)",
    ];
    limitLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // 検証: option 要素の個数が10個である
    expect(screen.getAllByRole("option")).toHaveLength(10);
  });

  // 【テスト】mode="ALL" では休日・年休なども含めた全就業形態が表示されること
  //   前提: mode に "ALL" を渡す
  //   操作: 部品を表示する
  //   期待: LIMIT の選択肢に加えて「休日」「年休」「公休」「シフト休」「代休」「欠勤」が表示され、
  //         option がちょうど16個ある
  it("ALL モードで全ての選択肢が表示されること", () => {
    // 操作: mode="ALL" で部品を表示
    render(<WorkSelect id="work" value="" onChange={mockOnChange} mode="ALL" />);
    // 検証: 全就業形態の選択肢を1つずつ確認する
    const allLabels = [
      "---", "出勤", "シフト出", "休出", "半前年休", "半後年休", "早退・遅刻",
      "出勤(時短なし)", "半前年休(時短なし)", "半後年休(時短なし)",
      "休日", "年休", "公休", "シフト休", "代休", "欠勤",
    ];
    allLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // 検証: option 要素の個数が16個である
    expect(screen.getAllByRole("option")).toHaveLength(16);
  });

  // 【テスト】disabled=true を渡すとプルダウンが選択不可になること
  //   前提: disabled に true を渡す
  //   操作: 部品を表示する
  //   期待: プルダウンが無効（disabled）状態である
  it("disabled=trueの場合、セレクトが無効化されること", () => {
    // 操作: disabled 付きで部品を表示
    render(<WorkSelect id="work" value="" onChange={mockOnChange} disabled={true} />);
    // 検証: プルダウンが無効化されている
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  // 【テスト】選択を変更すると onChange が呼ばれること
  //   前提: mode を渡さない（"LIMIT" 扱い）
  //   操作: プルダウンで「出勤」を選ぶ
  //   期待: mockOnChange が呼ばれる
  it("選択変更時に onChange が呼ばれること", () => {
    // 準備: 部品を表示
    render(<WorkSelect id="work" value="" onChange={mockOnChange} />);
    // 操作: プルダウン（combobox）で「出勤」を選ぶ
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "出勤" } });
    // 検証: 親に変更が通知される
    expect(mockOnChange).toHaveBeenCalled();
  });
});
