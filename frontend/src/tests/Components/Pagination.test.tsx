/**
 * ============================================================
 * ファイル名 : Pagination.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/Pagination.tsx（一覧画面のページ切り替えボタン部品）
 * 概要       : 「現在のページ / 総ページ数」の表示、先頭・最終ページでのボタン無効化、
 *              各ボタン（最初 / 前 / 次 / 最後）押下時に親の setCurrentPage が正しいページ番号で呼ばれることを確認する。
 *
 * モック方針 :
 *   - styles/Components/Pagination.module.css : CSS Modules のクラス名を固定の文字列にして単純化するため
 *   - setCurrentPage（親から渡す関数）        : 偽の関数 vi.fn() を渡し、呼ばれた引数を確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import Pagination from "../../Components/Pagination";

// ============================================================
// モック定義
// ============================================================

// CSS Modules のモック: styles["クラス名"] が同じ文字列をそのまま返すようにする
vi.mock("../../styles/Components/Pagination.module.css", () => ({
  default: {
    pagination: "pagination",
    "prev-button": "prev-button",
    "next-button": "next-button",
  },
}));

// ============================================================
// テスト本体
// ============================================================

// Pagination 部品の表示・ボタン無効化・ページ番号の通知を確認するテストグループ
describe("Pagination Component", () => {
  // 親コンポーネントの代わりに渡す偽の setCurrentPage（テストごとに作り直す）
  let setCurrentPage: ReturnType<typeof vi.fn>;

  // 各テストの前に: モックの呼び出し履歴を消し、偽の setCurrentPage を新しく作る
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentPage = vi.fn();
  });

  // 【テスト】「現在のページ / 総ページ数」が表示されること
  //   前提: 現在ページ 3・総ページ数 10
  //   操作: 部品を表示する
  //   期待: 「3 / 10」が表示される
  it("現在のページと総ページ数が正しく表示されること", () => {
    // 操作: 部品を表示
    render(<Pagination currentPage={3} totalPages={10} setCurrentPage={setCurrentPage} />);
    // 検証: ページ表示の文字がある
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
  });

  // 【テスト】1ページ目では「最初」「前」ボタンが押せないこと
  //   前提: 現在ページ 1・総ページ数 5
  //   操作: 部品を表示する
  //   期待: 「最初」「前」ボタンが無効（disabled）状態である
  it("currentPage=1 のとき 最初・前 ボタンが disabled になること", () => {
    // 操作: 1ページ目の状態で部品を表示
    render(<Pagination currentPage={1} totalPages={5} setCurrentPage={setCurrentPage} />);
    // 検証: 戻る方向のボタンが無効化されている
    expect(screen.getByText("最初")).toBeDisabled();
    expect(screen.getByText("前")).toBeDisabled();
  });

  // 【テスト】最終ページでは「次」「最後」ボタンが押せないこと
  //   前提: 現在ページ 5・総ページ数 5
  //   操作: 部品を表示する
  //   期待: 「次」「最後」ボタンが無効（disabled）状態である
  it("currentPage=totalPages のとき 次・最後 ボタンが disabled になること", () => {
    // 操作: 最終ページの状態で部品を表示
    render(<Pagination currentPage={5} totalPages={5} setCurrentPage={setCurrentPage} />);
    // 検証: 進む方向のボタンが無効化されている
    expect(screen.getByText("次")).toBeDisabled();
    expect(screen.getByText("最後")).toBeDisabled();
  });

  // 【テスト】「次」ボタンで現在ページ+1 が親に通知されること
  //   前提: 現在ページ 2・総ページ数 5
  //   操作: 「次」をクリック
  //   期待: setCurrentPage が 3 で呼ばれる
  it("次 ボタンをクリックすると setCurrentPage(currentPage+1) が呼ばれること", () => {
    // 準備: 2ページ目の状態で部品を表示
    render(<Pagination currentPage={2} totalPages={5} setCurrentPage={setCurrentPage} />);
    // 操作: 「次」をクリック
    fireEvent.click(screen.getByText("次"));
    // 検証: 2 + 1 = 3 ページ目が指定される
    expect(setCurrentPage).toHaveBeenCalledWith(3);
  });

  // 【テスト】「最初」ボタンで1ページ目が親に通知されること
  //   前提: 現在ページ 3・総ページ数 5
  //   操作: 「最初」をクリック
  //   期待: setCurrentPage が 1 で呼ばれる
  it("最初 ボタンをクリックすると setCurrentPage(1) が呼ばれること", () => {
    // 準備: 3ページ目の状態で部品を表示
    render(<Pagination currentPage={3} totalPages={5} setCurrentPage={setCurrentPage} />);
    // 操作: 「最初」をクリック
    fireEvent.click(screen.getByText("最初"));
    // 検証: 1ページ目が指定される
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  // 【テスト】「最後」ボタンで最終ページが親に通知されること
  //   前提: 現在ページ 2・総ページ数 5
  //   操作: 「最後」をクリック
  //   期待: setCurrentPage が 5 で呼ばれる
  it("最後 ボタンをクリックすると setCurrentPage(totalPages) が呼ばれること", () => {
    // 準備: 2ページ目の状態で部品を表示
    render(<Pagination currentPage={2} totalPages={5} setCurrentPage={setCurrentPage} />);
    // 操作: 「最後」をクリック
    fireEvent.click(screen.getByText("最後"));
    // 検証: 総ページ数（5）が指定される
    expect(setCurrentPage).toHaveBeenCalledWith(5);
  });

  // 【テスト】「前」ボタンで現在ページ-1 が親に通知されること
  //   前提: 現在ページ 3・総ページ数 5
  //   操作: 「前」をクリック
  //   期待: setCurrentPage が 2 で呼ばれる
  it("前 ボタンをクリックすると setCurrentPage(currentPage-1) が呼ばれること", () => {
    // 準備: 3ページ目の状態で部品を表示
    render(<Pagination currentPage={3} totalPages={5} setCurrentPage={setCurrentPage} />);
    // 操作: 「前」をクリック
    fireEvent.click(screen.getByText("前"));
    // 検証: 3 - 1 = 2 ページ目が指定される
    expect(setCurrentPage).toHaveBeenCalledWith(2);
  });

  // 【テスト】無効状態のボタンを押しても setCurrentPage が呼ばれないこと
  //   前提: 現在ページ 1・総ページ数 1（全ボタンが無効になる状態）
  //   操作: 「前」「最初」「次」「最後」を順にクリック
  //   期待: setCurrentPage が一度も呼ばれない
  it("disabled状態のボタンをクリックしてもsetCurrentPageが呼ばれないこと", () => {
    // 準備: 1ページしかない状態で部品を表示
    render(<Pagination currentPage={1} totalPages={1} setCurrentPage={setCurrentPage} />);
    // 操作: 4つのボタンをすべてクリック
    fireEvent.click(screen.getByText("前"));
    fireEvent.click(screen.getByText("最初"));
    fireEvent.click(screen.getByText("次"));
    fireEvent.click(screen.getByText("最後"));
    // 検証: どのボタンからもページ変更が通知されていない
    expect(setCurrentPage).not.toHaveBeenCalled();
  });
});
