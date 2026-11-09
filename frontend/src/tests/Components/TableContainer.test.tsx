/**
 * ============================================================
 * ファイル名 : TableContainer.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/TableContainer.tsx（一覧画面の表を囲む、高さ自動調整の外枠部品）
 * 概要       : 中身（children）がそのまま表示されること、スクロール設定、heightExpansion 指定時の
 *              最大の高さ（画面の高さ - 100px）、ref が空でも動くこと、リサイズ後も表示が残ることを確認する。
 *
 * モック方針 :
 *   - 見出し・検索欄の ref : 本物の画面の代わりに、offsetHeight（要素の高さ）を固定値にした
 *                            div 要素を ref として渡し、高さ計算の入力を一定にするため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import React from "react";

import TableContainer from "../../Components/TableContainer";

// ============================================================
// テスト本体
// ============================================================

// TableContainer 部品の表示・高さ計算・リサイズ対応を確認するテストグループ
describe("TableContainer", () => {
  /**
   * 指定した高さを持つ div 要素を作り、ref（{ current: 要素 }）の形で返す。
   *
   * テスト環境（jsdom）では画面描画をしないため offsetHeight が常に 0 になる。
   * そこで Object.defineProperty で offsetHeight を固定値に上書きし、高さを測った結果を再現する。
   *
   * @param height - 要素の高さとして返したい値（px）
   * @returns offsetHeight が height の div 要素を持つ ref オブジェクト
   */
  const createRef = (height: number) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
    return { current: el } as React.RefObject<HTMLElement>;
  };

  // 【テスト】外枠の中に渡した中身（children）が表示されること
  //   前提: 検索欄の高さ 50px・見出しの高さ 60px の ref を渡す
  //   操作: 中身に「Test Content」を入れて部品を表示する
  //   期待: 「Test Content」が表示される
  it("renders children", () => {
    // 準備: 高さ固定の ref を用意
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    // 操作: 部品を表示
    render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Test Content</div>
      </TableContainer>
    );
    // 検証: 中身がそのまま表示される
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  // 【テスト】外枠に縦・横スクロールの設定が付くこと
  //   前提: 検索欄の高さ 50px・見出しの高さ 60px の ref を渡す
  //   操作: 部品を表示する
  //   期待: 外枠の style の overflowY・overflowX がどちらも "auto"
  //         （テスト名は maxHeight だが、最大の高さの値そのものは確認していない）
  it("sets maxHeight based on window and refs", () => {
    // 準備: 高さ固定の ref を用意
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    // 操作: 部品を表示（container は描画結果を包む DOM 要素）
    const { container } = render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Content</div>
      </TableContainer>
    );
    // 検証: 最初の子要素（外枠の div）にスクロール設定が付いている
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.overflowY).toBe("auto");
    expect(wrapper.style.overflowX).toBe("auto");
  });

  // 【テスト】heightExpansion=true のとき、最大の高さが「画面の高さ - 100px」になること
  //   前提: heightExpansion に true を渡す（見出し・検索欄の高さは計算に使われない）
  //   操作: 部品を表示する
  //   期待: 外枠の maxHeight が window.innerHeight - 100 と等しい
  it("uses heightExpansion mode", () => {
    // 準備: 高さ固定の ref を用意
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    // 操作: 拡張モードで部品を表示
    const { container } = render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef} heightExpansion={true}>
        <div>Expanded Content</div>
      </TableContainer>
    );
    // 検証: style の maxHeight（"〇〇px"）を数値に変換し、画面の高さ - 100 と比べる
    const wrapper = container.firstChild as HTMLElement;
    const maxH = parseInt(wrapper.style.maxHeight);
    expect(maxH).toBe(window.innerHeight - 100);
  });

  // 【テスト】ref の中身が null（要素がまだ無い）でもエラーにならず表示されること
  //   前提: 検索欄・見出しの ref の current がどちらも null
  //   操作: 部品を表示する
  //   期待: 中身「Null Ref Content」が表示される（高さは 0 として計算される）
  it("handles null refs", () => {
    // 準備: 要素を指していない ref を用意
    const searchBarRef = { current: null } as React.RefObject<HTMLElement | null>;
    const headerRef = { current: null } as React.RefObject<HTMLElement | null>;
    // 操作: 部品を表示
    render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Null Ref Content</div>
      </TableContainer>
    );
    // 検証: 中身が表示される
    expect(screen.getByText("Null Ref Content")).toBeInTheDocument();
  });

  // 【テスト】ウィンドウのリサイズ（大きさ変更）が起きても中身が表示されたままであること
  //   前提: 検索欄の高さ 50px・見出しの高さ 60px の ref を渡す
  //   操作: 部品を表示した後、window に resize イベントを発生させる
  //   期待: 中身「Resize Content」が表示されたままである
  it("updates on window resize", () => {
    // 準備: 高さ固定の ref を用意し、部品を表示
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Resize Content</div>
      </TableContainer>
    );
    // 操作: resize イベントを発生させる（act で包み、高さの再計算と再描画が終わるまで待つ）
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    // 検証: 中身が表示されたままである
    expect(screen.getByText("Resize Content")).toBeInTheDocument();
  });
});
