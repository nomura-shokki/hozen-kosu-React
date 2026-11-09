/**
 * ============================================================
 * ファイル名 : MemberList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MemberPage/MemberList.tsx（人員一覧画面）
 * 概要       : 表の見出しと人員データの表示・権限/管理者権限の「有」「無」表示・
 *              エラー時（401/403）の遷移・0件時のメッセージ表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / TableContainer / Pagination / ShopSelect : 画面の本質と関係ない子部品を単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import MemberList from "../../MemberPage/MemberList";

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
// ShopSelect（ショップの絞り込みプルダウン）: 選択肢「---」と「P」の2つだけを持つ簡易版にする
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option><option value="P">P</option></select> }));

// ============================================================
// テスト本体
// ============================================================

// MemberList 画面の表示・エラー処理をまとめて確認するテストグループ
describe("MemberList Component", () => {
  // GET /api/member_list/ のレスポンス例（人員1人・全1件・1ページ20件）
  const mockData = {
    data: {
      // 一覧に表示する人員データ（権限あり・管理者ではない）
      results: [
        { employee_no: 101, name: "太郎", shop: "P", authority: true, administrator: false },
      ],
      count: 1, // 全件数
      page_size: 20, // 1ページあたりの件数
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockData を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockData);
  });

  // 【テスト】表の見出しと人員データが表示されること
  //   前提: APIは氏名「太郎」の人員1人を返す
  //   操作: 画面を表示する
  //   期待: 「太郎」と、見出し「従業員番号」「氏名」「ショップ」が表示される
  it("テーブルヘッダーとデータが正しく表示されること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <MemberList />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に氏名が表示される
    expect(await screen.findByText("太郎")).toBeInTheDocument();
    // 検証: 表の見出し列が表示される（検索欄のラベル「従業員番号：」等は完全一致しないため対象外）
    expect(screen.getByText("従業員番号")).toBeInTheDocument();
    expect(screen.getByText("氏名")).toBeInTheDocument();
    expect(screen.getByText("ショップ")).toBeInTheDocument();
  });

  // 【テスト】権限・管理者権限が true なら「有」、false なら「無」と表示されること
  //   前提: 人員データは authority=true、administrator=false
  //   操作: 画面を表示する
  //   期待: 「有」「無」がそれぞれ1つ以上表示される
  it("権限の有無が正しく表示されること", async () => {
    // 準備: 画面を表示し、一覧データの表示を待つ
    render(
      <MemoryRouter>
        <MemberList />
      </MemoryRouter>
    );

    await screen.findByText("太郎");
    // 検証: 権限（authority=true）の列が「有」と表示される
    const cells = screen.getAllByText("有");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    // 検証: 管理者権限（administrator=false）の列が「無」と表示される
    const noCells = screen.getAllByText("無");
    expect(noCells.length).toBeGreaterThanOrEqual(1);
  });

  // 【テスト】一覧取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("401エラー時に/loginへリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <MemberList />
      </MemoryRouter>
    );

    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】一覧取得APIが403（権限なし）を返したらメインメニューへ遷移すること
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
        <MemberList />
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
        <MemberList />
      </MemoryRouter>
    );

    // 検証: 0件時のメッセージが表示される
    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });
});
