/**
 * ============================================================
 * ファイル名 : DefDetailList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefDetailList.tsx（作業詳細選択肢一覧画面）
 * 概要       : 見出しの表示・一覧取得APIの呼び出し・取得データのテーブル表示・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
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

// ============================================================
// モック定義
// ============================================================

// api（共通axiosインスタンス）のモック: get/post/put/delete をすべて「何もしない偽の関数」に置き換える
vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from "../../api/axios";
// モック関数のメソッド（mockResolvedValue など）を型エラーなしで呼ぶため any として扱う
const mockedApi = api as any;

// axios.isAxiosError のモック: response プロパティを持つエラーなら true（通信エラー扱い）を返す
vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
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

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefDetailList from "../../DefinitionPage/DefDetailList";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_detail_list/ のレスポンス例（全1件・1ページ20件 → 全1ページ）
const mockResponse = {
  data: {
    // 一覧に表示する作業詳細選択肢（定義記号と作業詳細の組）
    results: [
      { id: 1, def_symbol: "A", def_select: "作業詳細A" },
    ],
    page_size: 20, // 1ページあたりの件数
    count: 1, // 全件数
    symbol_list: ["A", "B", "C"], // 絞り込み用プルダウンに並ぶ定義記号（工数区分記号）
  },
};

// ============================================================
// テスト本体
// ============================================================

// DefDetailList 画面の表示・データ取得・エラー処理をまとめて確認するテストグループ
describe("DefDetailList", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは作業詳細選択肢1件のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「作業詳細選択肢一覧」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("作業詳細選択肢一覧")).toBeInTheDocument();
  });

  // 【テスト】表示時に一覧取得APIが呼ばれること
  //   前提: APIは作業詳細選択肢1件のデータを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_detail_list/" とオプション（ページ番号・定義記号の params）付きで呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    // 検証: 一覧取得APIが何らかのオプションオブジェクト付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_list/", expect.any(Object));
    });
  });

  // 【テスト】一覧取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得したデータがテーブルに表示されること
  //   前提: APIは def_select="作業詳細A" の1件を返す
  //   操作: 画面を表示する
  //   期待: 「作業詳細A」が表示される
  it("displays data in table", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    // 検証: テーブルの作業詳細列にデータが表示される
    expect(await screen.findByText("作業詳細A")).toBeInTheDocument();
  });
});
