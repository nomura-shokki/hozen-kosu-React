import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import KosuList from "../../KosuPage/KosuList";

// api (カスタムaxiosインスタンス) のモック
vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
import api from "../../api/axios";
const mockedApi = api as any;

// axios.isAxiosError のモック
vi.mock("axios", () => ({
  default: {
    isAxiosError: vi.fn((err: any) => !!err.response),
  },
}));

// 子コンポーネントのモック
vi.mock("../../Components/Loading", () => ({
  default: () => null,
}));
vi.mock("../../Components/TableContainer", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../../Components/Pagination", () => ({
  default: ({ setCurrentPage, currentPage, totalPages }: any) => (
    <div data-testid="pagination">
      <button onClick={() => setCurrentPage(currentPage + 1)}>次</button>
      <button onClick={() => setCurrentPage(totalPages)}>最後</button>
    </div>
  ),
}));

// useNavigateのモック化
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    useLocation: () => ({ pathname: "/kosu-list", state: null }),
  };
});

describe("KosuList Component - 詳細結合テスト", () => {
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

  const mockDataPage2 = {
    data: {
      results: [{ id: 21, employee_no3: 121, name: "三郎", work_day2: "2023-10-21", tyoku2: "1", judgement: true }],
      count: 45,
      page_size: 20,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockDataPage1);
  });

  it("初期表示時にデータを取得し、フォーマットが正しく表示されること", async () => {
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    expect(await screen.findByText("2023-10-01 (日)")).toBeInTheDocument();
  });

  it("指定月ボタンをクリックした際、正しいAPIパラメータでリクエストされること", async () => {
    render(<MemoryRouter><KosuList /></MemoryRouter>);

    // 初期ロードを待つ
    await screen.findByText("2023-10-01 (日)");

    // 検索入力 (labelが空のためIDで取得)
    const dateInput = document.getElementById("search-day-input") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2023-10-01" } });

    // 履歴リセット
    mockedApi.get.mockClear();

    // 「指定月」ボタンをクリック
    const monthButton = screen.getByText("指定月");
    fireEvent.click(monthButton);

    // 検証
    await waitFor(() => {
      const calls = mockedApi.get.mock.calls;
      const match = calls.some((call: any) => {
        const params = call[1]?.params;
        return params?.mode === "month" && params?.day?.startsWith("2023-10");
      });
      expect(match).toBe(true);
    }, { timeout: 2000 });
  });

  it("「次」ボタンをクリックして2ページ目のデータを取得できること", async () => {
    mockedApi.get.mockResolvedValueOnce(mockDataPage1).mockResolvedValueOnce(mockDataPage2);
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    await screen.findByText("2023-10-01 (日)");
    fireEvent.click(screen.getByText("次"));
    expect(await screen.findByText("2023-10-21 (土)")).toBeInTheDocument();
  });

  it("「最後」ボタンで最終ページへ遷移すること", async () => {
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    await screen.findByText("2023-10-01 (日)");
    fireEvent.click(screen.getByText("最後"));
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        "/api/kosu_list/",
        expect.objectContaining({ params: expect.objectContaining({ page: 3 }) })
      );
    });
  });

  it("APIが403を返した場合、メインメニューにリダイレクトされること", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403, data: { message: "権限がありません" } } });
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
