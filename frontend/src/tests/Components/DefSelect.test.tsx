/**
 * ============================================================
 * ファイル名 : DefSelect.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/DefSelect.tsx（工数区分を選ぶプルダウン部品）
 * 概要       : 工数区分定義データから選択肢が作られること（空欄・無関係なキーは除外）、
 *              固定の「---」「休憩」が必ずあること、変更通知と無効化（disabled）を確認する。
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
import DefSelect from "../../Components/DefSelect";

// ============================================================
// テスト本体
// ============================================================

// DefSelect 部品の選択肢生成・変更通知・無効化を確認するテストグループ
describe("DefSelect Component", () => {
  // 親コンポーネントの代わりに渡す偽の onChange（呼び出し履歴を記録する）
  const mockOnChange = vi.fn();

  // 工数区分定義データの例
  //   kosu_title_1 / 2 : 工数区分名あり → 選択肢になる（記号 A / B）
  //   kosu_title_3     : 空欄 → 選択肢にならない
  //   other_key        : kosu_title_ で始まらない → 無視される
  const defData = {
    kosu_title_1: "組立",
    kosu_title_2: "検査",
    kosu_title_3: "",
    other_key: "無関係",
  };

  // 各テストの前に: 偽の関数の呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】未選択用の「---」と固定の「休憩」が表示されること
  //   前提: 上記の工数区分定義データを渡す
  //   操作: 部品を表示する
  //   期待: 「---」と「休憩」が表示される
  it("--- デフォルトオプションと 休憩 オプションが表示されること", () => {
    // 準備: 部品を表示
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} />);
    // 検証: 固定の2つの選択肢がある
    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("休憩")).toBeInTheDocument();
  });

  // 【テスト】kosu_title_ で始まり、工数区分名が空でないものだけが選択肢になること
  //   前提: 組立・検査・空欄・無関係なキーを含む工数区分定義データを渡す
  //   操作: 部品を表示する
  //   期待: 「組立」「検査」が表示され、option は「---」「組立」「検査」「休憩」の4個だけ
  it("kosu_title_ で始まるキーのうち空でないもののみオプションとして表示されること", () => {
    // 準備: 部品を表示
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} />);
    // 検証: 工数区分名がある2件が表示される
    expect(screen.getByText("組立")).toBeInTheDocument();
    expect(screen.getByText("検査")).toBeInTheDocument();
    // 空欄の kosu_title_3 は表示されない
    // kosu_title_ で始まらない other_key も表示されない
    const options = screen.getAllByRole("option");
    // 検証: 「---」「組立」「検査」「休憩」の4個だけである
    expect(options).toHaveLength(4);
  });

  // 【テスト】選択を変更すると onChange が呼ばれること
  //   前提: 上記の工数区分定義データを渡す
  //   操作: プルダウンで値 "A"（1番目の工数区分＝組立）を選ぶ
  //   期待: mockOnChange が呼ばれる
  it("選択変更時に onChange が呼ばれること", () => {
    // 準備: 部品を表示し、プルダウン（combobox）を取得
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} />);
    const select = screen.getByRole("combobox");
    // 操作: 記号 "A"（組立）を選ぶ
    fireEvent.change(select, { target: { value: "A" } });
    // 検証: 親に変更が通知される
    expect(mockOnChange).toHaveBeenCalled();
  });

  // 【テスト】工数区分定義データが空のときは「---」と「休憩」だけになること
  //   前提: 空のオブジェクト {} を渡す
  //   操作: 部品を表示する
  //   期待: option が2個で、「---」と「休憩」が表示される
  it("空のdefDataの場合、---と休憩のみ表示されること", () => {
    // 準備: 空の工数区分定義データで部品を表示
    render(<DefSelect value="" onChange={mockOnChange} defData={{}} />);
    // 検証: 選択肢は固定の2個だけである
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("休憩")).toBeInTheDocument();
  });

  // 【テスト】disabled=true を渡すとプルダウンが選択不可になること
  //   前提: disabled に true を渡す
  //   操作: 部品を表示する
  //   期待: プルダウンが無効（disabled）状態である
  it("disabled=trueの場合、セレクトが無効化されること", () => {
    // 準備: disabled 付きで部品を表示
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} disabled={true} />);
    // 検証: プルダウンが無効化されている
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
