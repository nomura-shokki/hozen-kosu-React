/**
 * ============================================================
 * ファイル名 : KosuDisplay.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/KosuDisplay.tsx（作業内容・作業詳細を時間帯ごとの表で表示する部品）
 * 概要       : 表の見出し・見出しの背景色指定・工数区分名や「休憩」の行表示を確認する。
 *              あわせて、直（1〜4・6・不明値）とショップ（組立系 / それ以外）の組み合わせ、
 *              空の作業内容、ウィンドウのリサイズでもエラーにならず表が描画されることを確認する。
 *              ※多くのテストは見出し「作業時間」が出ること（＝描画できたこと）だけを確認している。
 *
 * モック方針 :
 *   - なし（子部品や通信を持たない部品のため、本物をそのまま描画する）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする

import KosuDisplay from "../../Components/KosuDisplay";

// ============================================================
// テスト本体
// ============================================================

// KosuDisplay 部品の表示と、様々な入力での描画を確認するテストグループ
describe("KosuDisplay", () => {
  // 各テストで共通に渡す props（必要な項目だけテストごとに上書きする）
  const baseProps = {
    // 作業内容: 288コマ（1コマ5分 × 24時間）すべて工数区分 A
    timeWork: "A".repeat(288),
    // 作業詳細: 288コマすべて "detail" を "$" 区切りでつないだ文字列
    workDetail: Array(288).fill("detail").join("$"),
    // 更新日時: 固定の日付（値が変わると表が作り直される）
    updatedAt: new Date("2025-01-01"),
    // 工数区分定義データ: 1番目の工数区分（記号 A）の名前は「作業A」
    defData: { kosu_title_1: "作業A" } as { [key: string]: string | undefined },
    tyoku: "1", // 直: 1直
    shop: "W1", // ショップ: W1（組立系）
  };

  // 【テスト】表の見出し（作業時間 / 作業内容 / 作業詳細）が表示されること
  //   前提: 共通の props を渡す
  //   操作: 部品を表示する
  //   期待: 「作業時間」「作業内容」「作業詳細」が表示される
  it("renders table headers", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} />);
    // 検証: 3つの見出しがある
    expect(screen.getByText("作業時間")).toBeInTheDocument();
    expect(screen.getByText("作業内容")).toBeInTheDocument();
    expect(screen.getByText("作業詳細")).toBeInTheDocument();
  });

  // 【テスト】headerColor を渡すと見出しの背景色がその色になること
  //   前提: headerColor に "#ff0000"（赤）を渡す
  //   操作: 部品を表示する
  //   期待: 1つ目の見出しセルの背景色が #ff0000 である
  it("renders with headerColor prop", () => {
    // 操作: 見出し色を指定して部品を表示
    render(<KosuDisplay {...baseProps} headerColor="#ff0000" />);
    // 検証: 見出しセル（columnheader = th 要素）の1つ目に背景色が付いている
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveStyle({ backgroundColor: "#ff0000" });
  });

  // 【テスト】作業内容の記号が工数区分名に変換されて行に表示されること
  //   前提: 作業内容は全て "A"、工数区分定義の kosu_title_1 は「作業A」、直 "1"
  //   操作: 部品を表示する
  //   期待: 「作業A」が表示される（全コマ同じ作業のため1行にまとまる）
  it("renders parsed data rows for tyoku 1", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} />);
    // 検証: 記号 A が工数区分名「作業A」として表示される
    expect(screen.getByText("作業A")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系ショップ（W1）でも表が描画されること
  //   前提: 直 "2"、ショップ W1（表が 08:50 始まりになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with tyoku 2 and W1 shop", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="2" shop="W1" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系以外のショップ（P）でも表が描画されること
  //   前提: 直 "2"、ショップ P（表が 11:50 始まりになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with tyoku 2 and non-W shop", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="2" shop="P" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】3直・組立系ショップ（W2）でも表が描画されること
  //   前提: 直 "3"、ショップ W2（表が 17:50 始まりになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with tyoku 3 and W2 shop", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="3" shop="W2" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】3直・組立系以外のショップ（P）でも表が描画されること
  //   前提: 直 "3"、ショップ P（表が 20:25 始まりになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with tyoku 3 and non-W shop", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="3" shop="P" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】常昼（直 "4"）でも表が描画されること
  //   前提: 直 "4"（表が 06:00 始まりになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with tyoku 4", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="4" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】連2直（直 "6"）でも表が描画されること
  //   前提: 直 "6"（表が 15:10 始まりになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with tyoku 6", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="6" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】存在しない直の値でも表が描画されること
  //   前提: 直 "9"（並べ替えをせず 00:00 始まりのままになる分岐）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with unknown tyoku (default)", () => {
    // 操作: 想定外の直 "9" で部品を表示
    render(<KosuDisplay {...baseProps} tyoku="9" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】作業内容の "$" が「休憩」として表示されること
  //   前提: 作業内容は "$" が288個（終日休憩）
  //   操作: 部品を表示する
  //   期待: 「休憩」が表示される
  it("handles break character ($) in timeWork", () => {
    // 準備: 288コマすべて休憩（"$"）の作業内容
    const timeWork = "$".repeat(288);
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} timeWork={timeWork} />);
    // 検証: 作業内容の列に「休憩」が表示される
    expect(screen.getByText("休憩")).toBeInTheDocument();
  });

  // 【テスト】未入力 "#" を含む作業内容でも、入力済みの部分が行として表示されること
  //   前提: 作業内容は先頭50コマが "A"、残り238コマが "#"（未入力）
  //   操作: 部品を表示する
  //   期待: 「作業A」が表示される（未入力の時間帯は行にならない）
  it("handles hash character (#) in timeWork", () => {
    // 準備: 先頭50コマ（4時間10分）だけ工数区分 A、残りは未入力の作業内容
    const timeWork = "A".repeat(50) + "#".repeat(238);
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} timeWork={timeWork} />);
    // 検証: 入力済みの時間帯が「作業A」の行として表示される
    expect(screen.getByText("作業A")).toBeInTheDocument();
  });

  // 【テスト】作業内容・作業詳細が空文字でも表が描画されること
  //   前提: timeWork と workDetail に "" を渡す
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("handles empty timeWork", () => {
    // 操作: 空の作業内容・作業詳細で部品を表示
    render(<KosuDisplay {...baseProps} timeWork="" workDetail="" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】ウィンドウのリサイズ（大きさ変更）が起きても表が表示されたままであること
  //   前提: 共通の props を渡す
  //   操作: 部品を表示した後、window に resize イベントを発生させる
  //   期待: 見出し「作業時間」が表示されたままである
  it("responds to window resize", () => {
    // 準備: 部品を表示
    render(<KosuDisplay {...baseProps} />);
    // 操作: resize イベントを発生させる（act で包み、state 更新と再描画が終わるまで待つ）
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    // 検証: 表が表示されたままである
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系ショップ（A1）でも表が描画されること
  //   前提: 直 "2"、ショップ A1（A1 も組立系として 08:50 始まりの分岐に入る）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with A1 shop for tyoku 2", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="2" shop="A1" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】3直・組立系ショップ（A2）でも表が描画されること
  //   前提: 直 "3"、ショップ A2（A2 も組立系として 17:50 始まりの分岐に入る）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with A2 shop for tyoku 3", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="3" shop="A2" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系ショップ（J）でも表が描画されること
  //   前提: 直 "2"、ショップ J（J も組立系として 08:50 始まりの分岐に入る）
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される
  it("renders with J shop for tyoku 2", () => {
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} tyoku="2" shop="J" />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  // 【テスト】複数の工数区分が並ぶ作業内容でも表が描画されること
  //   前提: 工数区分定義は 作業A / 作業B / 作業C、作業内容は A×100・B×100・C×88 コマ
  //   操作: 部品を表示する
  //   期待: 見出し「作業時間」が表示される（各工数区分名の行までは確認していない）
  it("renders with multiple def data entries", () => {
    // 準備: 3つの工数区分を持つ工数区分定義データ
    const defData = {
      kosu_title_1: "作業A",
      kosu_title_2: "作業B",
      kosu_title_3: "作業C",
    };
    // 準備: A → B → C の順に作業が切り替わる作業内容（合計288コマ）
    const timeWork = "A".repeat(100) + "B".repeat(100) + "C".repeat(88);
    // 操作: 部品を表示
    render(<KosuDisplay {...baseProps} defData={defData} timeWork={timeWork} />);
    // 検証: エラーにならず表が描画されている
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });
});
