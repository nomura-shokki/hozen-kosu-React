/**
 * ============================================================
 * ファイル名 : DefList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefList.tsx（工数区分定義一覧画面）
 * 概要       : 一覧の初期表示・各行の編集/削除リンクの表示・
 *              権限なし（403）時の遷移・0件時のメッセージ表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / TableContainer / Pagination : 画面の本質と関係ない子部品を単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import DefList from "../../DefinitionPage/DefList";

// ============================================================
// モック定義
// ============================================================

// api（共通axiosインスタンス）のモック: get/post/put/delete をすべて「何もしない偽の関数」に置き換える
vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
import api from "../../api/axios";
// モック関数のメソッド（mockResolvedValue など）を型エラーなしで呼ぶため any として扱う
const mockedApi = api as any;

// axios.isAxiosError のモック: response プロパティを持つエラーなら true（通信エラー扱い）を返す
vi.mock("axios", () => ({
  default: {
    isAxiosError: vi.fn((err) => !!err.response),
  },
}));

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TableContainer: 高さ計算などを省き、中身をそのまま表示するだけにする
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
// Pagination: ページ切り替え機能は持たず、「Pagination」という文字だけを表示する
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));

// ============================================================
// テスト本体
// ============================================================

// DefList 画面の表示・リンク・エラー処理をまとめて確認するテストグループ
describe("DefList Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返す値は各テストで個別に設定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】見出しと工数区分定義Verの一覧データが表示されること
  //   前提: APIは定義Ver「Ver1」1件（全1件・1ページ20件）を返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数区分定義一覧」と「Ver1」が表示される
  it("工数区分定義一覧とテーブルデータが表示されること", async () => {
    // 準備: 1回目の一覧取得APIで1件のデータを返す
    mockedApi.get.mockResolvedValueOnce({
      data: { results: [{ id: 1, kosu_name: "Ver1" }], count: 1, page_size: 20 },
    });

    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数区分定義一覧")).toBeInTheDocument();
    // 検証: 一覧の行に定義Ver名が表示される
    expect(screen.getByText("Ver1")).toBeInTheDocument();
  });

  // 【テスト】各行に「編集」「削除」のリンクが表示されること
  //   前提: APIは定義Ver「Ver1」1件を返す
  //   操作: 画面を表示する
  //   期待: 「編集」「削除」の文字がそれぞれ1つ以上ある
  it("編集・削除リンクが表示されること", async () => {
    // 準備: 1回目の一覧取得APIで1件のデータを返す
    mockedApi.get.mockResolvedValueOnce({
      data: { results: [{ id: 1, kosu_name: "Ver1" }], count: 1, page_size: 20 },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    // 準備: 一覧データの表示を待つ
    await screen.findByText("Ver1");
    // 検証: 「編集」が1つ以上ある（表の見出し列名とリンクの両方が該当するため getAll で数を確認）
    const editLinks = screen.getAllByText("編集");
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
    // 検証: 「削除」も同様に1つ以上ある
    const deleteLinks = screen.getAllByText("削除");
    expect(deleteLinks.length).toBeGreaterThanOrEqual(1);
  });

  // 【テスト】一覧取得APIが403（管理者権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("403エラー時に/へリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403, data: { message: "Forbidden" } },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】データが0件のとき「No data found.」と表示されること
  //   前提: APIは results が空配列（全0件）のデータを返す
  //   操作: 画面を表示する
  //   期待: 「No data found.」が表示される（表は表示されない）
  it("データが空の場合にNo data found.が表示されること", async () => {
    // 準備: 1回目の一覧取得APIで0件のデータを返す
    mockedApi.get.mockResolvedValueOnce({
      data: { results: [], count: 0, page_size: 20 },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    // 検証: 0件時のメッセージが表示される
    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });
});
