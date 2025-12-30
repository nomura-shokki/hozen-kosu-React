import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import KosuList from "../../KosuPage/KosuList";

/**
 * axiosのモック化
 */
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn((err) => !!err.isAxiosError),
  },
}));

const mockedAxios = axios as any;

/**
 * useNavigateのモック化
 */
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe("KosuList Component - 詳細結合テスト修正版", () => {
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
    mockedAxios.get.mockResolvedValue(mockDataPage1);
  });

  it("初期表示時にデータを取得し、フォーマットが正しく表示されること", async () => {
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    expect(await screen.findByText("2023-10-01 (日)")).toBeInTheDocument();
  });

  it("指定月ボタンをクリックした際、正しいAPIパラメータでリクエストされること", async () => {
    render(<MemoryRouter><KosuList /></MemoryRouter>);

    // 初期ロードを待つ
    await screen.findByText("2023-10-01 (日)");
    
    // 検索入力
    const dateInput = screen.getByLabelText(/就業日：/);

    fireEvent.change(dateInput, { target: { value: "2023-10-01" } });

    // 履歴リセット
    mockedAxios.get.mockClear();

    // 「指定月」ボタンをクリック
    const monthButton = screen.getByText("指定月");
    fireEvent.click(monthButton);

    // 検証
    await waitFor(() => {
      // toHaveBeenCalledWith ではなく toHaveBeenCalled 後の検証に分ける（デバッグしやすいため）
      const calls = mockedAxios.get.mock.calls;
      const match = calls.some((call: any) => {
        const params = call[1]?.params;
        // modeが'month'であり、かつdayが'2023-10'から始まっていることを確認
        return params?.mode === "month" && params?.day?.startsWith("2023-10");
      });
      expect(match).toBe(true);
    }, { timeout: 2000 });
  });

  it("「次」ボタンをクリックして2ページ目のデータを取得できること", async () => {
    mockedAxios.get.mockResolvedValueOnce(mockDataPage1).mockResolvedValueOnce(mockDataPage2);
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
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: expect.objectContaining({ page: 3 }) })
      );
    });
  });

  it("APIが403を返した場合、トップページへリダイレクトすること", async () => {
    mockedAxios.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } });
    render(<MemoryRouter><KosuList /></MemoryRouter>);
    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith("/"));
  });
});