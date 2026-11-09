/**
 * ============================================================
 * ファイル名 : KosuList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuList.tsx（工数履歴一覧画面）
 * 概要       : 一覧の初期表示・指定月検索・ページ切り替え・権限エラー時の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - Loading / TableContainer / Pagination : 画面の本質と関係ない子部品を単純化するため
 *   - react-router-dom の useNavigate / useLocation : 画面遷移先の確認と URL の固定のため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import KosuList from "../../KosuPage/KosuList";

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
    isAxiosError: vi.fn((err: any) => !!err.response),
  },
}));

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({
  default: () => null,
}));
// TableContainer: 高さ計算などを省き、中身をそのまま表示するだけにする
vi.mock("../../Components/TableContainer", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
// Pagination: 「次」（現在ページ+1）と「最後」（最終ページ）の2つのボタンだけを持つ簡易版にする
vi.mock("../../Components/Pagination", () => ({
  default: ({ setCurrentPage, currentPage, totalPages }: any) => (
    <div data-testid="pagination">
      <button onClick={() => setCurrentPage(currentPage + 1)}>次</button>
      <button onClick={() => setCurrentPage(totalPages)}>最後</button>
    </div>
  ),
}));

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  // Link や MemoryRouter など、それ以外の機能は本物をそのまま使う
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    // 現在のURLを工数履歴一覧画面（/kosu-list）に固定する
    useLocation: () => ({ pathname: "/kosu-list", state: null }),
  };
});

// ============================================================
// テスト本体
// ============================================================

// KosuList 画面の表示・検索・ページ切り替え・エラー処理をまとめて確認するテストグループ
describe("KosuList Component - 詳細結合テスト", () => {
  // 1ページ目のAPIレスポンス例（全45件・1ページ20件 → 全3ページ）
  const mockDataPage1 = {
    data: {
      results: [
        { id: 1, employee_no3: 101, name: "太郎", work_day2: "2023-10-01", tyoku2: "1", judgement: true },
        { id: 2, employee_no3: 102, name: "次郎", work_day2: "2023-10-02", tyoku2: "2", judgement: false },
      ],
      count: 45,
      page_size: 20,
    },
  };

  // 2ページ目のAPIレスポンス例
  const mockDataPage2 = {
    data: {
      results: [{ id: 21, employee_no3: 121, name: "三郎", work_day2: "2023-10-21", tyoku2: "1", judgement: true }],
      count: 45,
      page_size: 20,
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に1ページ目のデータを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockDataPage1);
  });

  // 【テスト】初期表示で工数データが取得され、就業日が曜日付きで表示されること
  //   前提: APIは1ページ目のデータを返す
  //   操作: 画面を表示する
  //   期待: 「2023-10-01 (日)」という表示がある
  it("初期表示時にデータを取得し、フォーマットが正しく表示されること", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    // 検証: 就業日と曜日が表示されるまで待って確認する
    expect(await screen.findByText("2023-10-01 (日)")).toBeInTheDocument();
  });

  // 【テスト】「指定月」ボタンで月単位の検索パラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 日付欄に 2023-10-01 を入力し、「指定月」をクリック
  //   期待: api.get が mode="month"・day="2023-10…" のパラメータ付きで呼ばれる
  it("指定月ボタンをクリックした際、正しいAPIパラメータでリクエストされること", async () => {
    // 準備: 画面を表示
    render(<MemoryRouter><KosuList /></MemoryRouter>);

    // 準備: 初期表示のデータ取得が終わるのを待つ
    await screen.findByText("2023-10-01 (日)");

    // 操作: 日付欄に入力（label の文字が空のため、ラベル名ではなくIDで要素を取得する）
    const dateInput = document.getElementById("search-day-input") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2023-10-01" } });

    // 準備: 初期表示時の呼び出し履歴を消し、検索時の呼び出しだけを確認できるようにする
    mockedApi.get.mockClear();

    // 操作: 「指定月」ボタンをクリック
    const monthButton = screen.getByText("指定月");
    fireEvent.click(monthButton);

    // 検証: いずれかの api.get 呼び出しが mode="month" かつ day が "2023-10" で始まるパラメータを持つ
    await waitFor(() => {
      const calls = mockedApi.get.mock.calls;
      const match = calls.some((call: any) => {
        // call[0] はURL、call[1] は axios のオプション（params に送信パラメータが入る）
        const params = call[1]?.params;
        return params?.mode === "month" && params?.day?.startsWith("2023-10");
      });
      expect(match).toBe(true);
    }, { timeout: 2000 });
  });

  // 【テスト】「次」ボタンで2ページ目のデータが表示されること
  //   前提: APIは1回目に1ページ目、2回目に2ページ目のデータを返す
  //   操作: 初期表示後に「次」をクリック
  //   期待: 2ページ目の「2023-10-21 (土)」が表示される
  it("「次」ボタンをクリックして2ページ目のデータを取得できること", async () => {
    // 準備: 呼び出し順に異なるレスポンスを返すよう設定し、画面を表示
    mockedApi.get.mockResolvedValueOnce(mockDataPage1).mockResolvedValueOnce(mockDataPage2);
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    await screen.findByText("2023-10-01 (日)");
    // 操作: 「次」ボタンをクリック
    fireEvent.click(screen.getByText("次"));
    // 検証: 2ページ目のデータが表示される
    expect(await screen.findByText("2023-10-21 (土)")).toBeInTheDocument();
  });

  // 【テスト】「最後」ボタンで最終ページ（3ページ目）を要求すること
  //   前提: 全45件・1ページ20件（全3ページ）
  //   操作: 初期表示後に「最後」をクリック
  //   期待: api.get が page=3 のパラメータ付きで呼ばれる
  it("「最後」ボタンで最終ページへ遷移すること", async () => {
    // 準備: 画面を表示して初期表示を待つ
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    await screen.findByText("2023-10-01 (日)");
    // 操作: 「最後」ボタンをクリック
    fireEvent.click(screen.getByText("最後"));
    // 検証: /api/kosu_list/ が page: 3 を含むパラメータで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        "/api/kosu_list/",
        expect.objectContaining({ params: expect.objectContaining({ page: 3 }) })
      );
    });
  });

  // 【テスト】APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("APIが403を返した場合、メインメニューにリダイレクトされること", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403, data: { message: "権限がありません" } } });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
