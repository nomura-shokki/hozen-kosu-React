/**
 * ============================================================
 * ファイル名 : Loading.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/Loading.tsx（読み込み中に表示する「Loading...」部品）
 * 概要       : 読み込み中は「Loading...」が表示されること、読み込み完了時は fadeOut クラスが付き、
 *              1秒（1000ミリ秒）後に要素ごと消えることを確認する。
 *
 * モック方針 :
 *   - img/helmet.png                       : 画像ファイルの読み込みを、固定のファイル名文字列に置き換えるため
 *   - styles/Components/Loading.module.css : CSS Modules のクラス名を固定の文字列にして、
 *                                            テストからクラス名（fadeOut など）で確認できるようにするため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import Loading from "../../Components/Loading";

// ============================================================
// モック定義
// ============================================================

// 画像のモック: import した画像の値を "helmet.png" という文字列にする
vi.mock("../../img/helmet.png", () => ({ default: "helmet.png" }));

// CSS Modules のモック: styles.クラス名 が同じ文字列をそのまま返すようにする
vi.mock("../../styles/Components/Loading.module.css", () => ({
  default: {
    loading: "loading",
    fadeOut: "fadeOut",
    item: "item",
    sway: "sway",
    loadingText: "loadingText",
  },
}));

// ============================================================
// テスト本体
// ============================================================

// Loading 部品の表示・フェードアウト・消去を確認するテストグループ
describe("Loading Component", () => {
  // 各テストの前に: モックの呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】読み込み中は「Loading...」の文字が表示されること
  //   前提: isLoading に true を渡す
  //   操作: 部品を表示する
  //   期待: 「Loading...」が表示される
  it("isLoading=true のとき Loading... テキストが表示されること", () => {
    // 操作: 読み込み中の状態で部品を表示
    render(<Loading isLoading={true} />);
    // 検証: 文字が表示されている
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  // 【テスト】読み込み完了時はフェードアウト用の fadeOut クラスが付くこと
  //   前提: isLoading に false を渡す
  //   操作: 部品を表示する
  //   期待: id="loading" の外枠要素に fadeOut クラスが付いている
  it("isLoading=false のとき fadeOut クラスが付与されること", () => {
    // 操作: 読み込み完了の状態で部品を表示
    render(<Loading isLoading={false} />);
    // 検証: 「Loading...」の文字から一番近い id="loading" の祖先要素を探し、クラスを確認する
    const loadingDiv = screen.getByText("Loading...").closest("#loading");
    expect(loadingDiv).toHaveClass("fadeOut");
  });

  // 【テスト】読み込み完了から1000ミリ秒後に、ローディング表示が要素ごと消えること
  //   前提: 偽のタイマー（時間を手動で進められる仕組み）を使い、isLoading に false を渡す
  //   操作: 部品を表示し、時間を1000ミリ秒進める
  //   期待: 進める前は「Loading...」があり、進めた後は id="loading" の要素が無い
  it("isLoading=false のとき、タイムアウト後に null を返すこと", () => {
    // 準備: setTimeout を実時間で待たずに済むよう、偽のタイマーに切り替える
    vi.useFakeTimers();
    // 準備: 読み込み完了の状態で部品を表示
    const { container } = render(<Loading isLoading={false} />);

    // 検証: フェードアウト中（1秒経過前）はまだ表示されている
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // 操作: 時間を1000ミリ秒進める（act で包み、タイマー内の state 更新と再描画を反映させる）
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 検証: 1000ミリ秒経過後は完全に消えている
    expect(container.querySelector("#loading")).toBeNull();

    // 後片付け: 他のテストに影響しないよう、本物のタイマーに戻す
    vi.useRealTimers();
  });
});
