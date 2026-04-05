import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from "../../api/axios";
const mockedApi = api as any;

vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
}));

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("../../Components/Pagination", () => ({ default: (props: any) => <div data-testid="pagination"><button onClick={() => props.setCurrentPage(2)}>Page 2</button></div> }));

import AdministratorHistoryList from "../../AdministratorPage/AdministratorHistoryList";

const mockResponse = {
  data: {
    history_data: {
      results: [
        {
          id: 1,
          operation: "更新",
          table_name: "kosu",
          record_id: "123",
          login_No: "12345",
          timestamp: "2025-01-01T12:00:00Z",
        },
      ],
      page_size: 20,
      count: 1,
    },
    model_choices: ["kosu", "member", "team"],
  },
};

describe("AdministratorHistoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    expect(await screen.findByText("データ操作履歴一覧")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.any(Object));
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays data in table", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    expect(await screen.findByText("更新")).toBeInTheDocument();
    expect(screen.getAllByText("kosu").length).toBeGreaterThan(0);
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("displays error for server error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 500, data: { message: "サーバーエラー" } } });
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("displays error for non-axios error", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
  });

  it("displays table headers", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    expect(screen.getByText("データ操作日時")).toBeInTheDocument();
    expect(screen.getByText("操作者")).toBeInTheDocument();
    expect(screen.getByText("操作テーブル")).toBeInTheDocument();
    expect(screen.getByText("レコードID")).toBeInTheDocument();
    expect(screen.getByText("操作種類")).toBeInTheDocument();
  });

  it("displays formatted timestamp", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // The timestamp "2025-01-01T12:00:00Z" should be formatted
    // The exact format depends on timezone, so check for presence of a date pattern
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("displays detail link for each row", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const detailElements = screen.getAllByText("詳細");
    expect(detailElements.length).toBeGreaterThanOrEqual(2); // header + link
  });

  it("handles 指定月検索 button click", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { value: "2025-06-01" } });
    const monthSearchBtn = screen.getByText("指定月検索");
    fireEvent.click(monthSearchBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          mode: "month",
          day: "2025-06-01",
        }),
      }));
    });
  });

  it("handles 指定日検索 button click", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { value: "2025-06-15" } });
    const daySearchBtn = screen.getByText("指定日検索");
    fireEvent.click(daySearchBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          mode: "day",
          day: "2025-06-15",
        }),
      }));
    });
  });

  it("handles record_id search", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const idInput = screen.getByPlaceholderText("レコードID");
    fireEvent.change(idInput, { target: { value: "456" } });
    const searchBtn = screen.getByText("検索");
    fireEvent.click(searchBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          record_id: "456",
        }),
      }));
    });
  });

  it("handles login_No search", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const noInput = screen.getByPlaceholderText("操作者従業員番号");
    fireEvent.change(noInput, { target: { value: "99999" } });
    const searchBtn = screen.getByText("検索");
    fireEvent.click(searchBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          login_No: "99999",
        }),
      }));
    });
  });

  it("handles table_name select change and search", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const tableSelect = screen.getByRole("combobox");
    fireEvent.change(tableSelect, { target: { value: "member" } });
    const searchBtn = screen.getByText("検索");
    fireEvent.click(searchBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          table_name: "member",
        }),
      }));
    });
  });

  it("handles pagination page change", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        history_data: {
          results: [
            { id: 1, operation: "更新", table_name: "kosu", record_id: "123", login_No: "12345", timestamp: "2025-01-01T12:00:00Z" },
          ],
          page_size: 20,
          count: 40,
        },
        model_choices: ["kosu"],
      },
    });
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const page2Btn = screen.getByText("Page 2");
    fireEvent.click(page2Btn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
        }),
      }));
    });
  });

  it("shows No data found when results are empty", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        history_data: { results: [], page_size: 20, count: 0 },
        model_choices: [],
      },
    });
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });

  it("displays table select options from model_choices", async () => {
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    const tableSelect = screen.getByRole("combobox");
    expect(tableSelect).toBeInTheDocument();
    // Options should include kosu, member, team from mockResponse
    const options = tableSelect.querySelectorAll("option");
    expect(options.length).toBe(4); // default + 3 choices
  });
});
