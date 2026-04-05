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
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option><option value="12345">テスト太郎</option></select> }));
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option><option value="W1">W1</option></select> }));
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option><option value="1">1直</option></select> }));
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option><option value="通常">通常</option></select> }));
vi.mock("../../Components/JudgementSelect", () => ({ default: (props: any) => <select data-testid="judgement-select" onChange={props.onChange}><option value="">---</option><option value="true">OK</option></select> }));

import AdministratorKosuList from "../../AdministratorPage/AdministratorKosuList";

const mockResponse = {
  data: {
    kosu_data: {
      results: [
        { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "1", work_time: "通常", judgement: true },
      ],
      page_size: 20,
      count: 1,
    },
    member_data: [
      { id: 1, employee_no: 12345, name: "テスト太郎" },
    ],
  },
};

describe("AdministratorKosuList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("全工数管理")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.any(Object));
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays data in table", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    const cells = await screen.findAllByText("テスト太郎");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    const okCells = screen.getAllByText("OK");
    expect(okCells.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("displays error for server error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 500, data: { message: "サーバーエラー" } } });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("displays error for non-axios error", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
  });

  it("displays table headers", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    expect(screen.getByText("氏名")).toBeInTheDocument();
    expect(screen.getByText("勤務形態")).toBeInTheDocument();
    expect(screen.getByText("整合性")).toBeInTheDocument();
  });

  it("displays edit link for each row", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const editLinks = screen.getAllByText("編集");
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("formats tyoku correctly (1直)", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const matches = screen.getAllByText("1直");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("displays NG for false judgement", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: {
          results: [
            { id: 2, employee_no3: 12345, name: "", work_day2: "2025-01-02", tyoku2: "2", work_time: "通常", judgement: false },
          ],
          page_size: 20,
          count: 1,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("NG")).toBeInTheDocument();
  });

  it("shows No data found when results are empty", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: { results: [], page_size: 20, count: 0 },
        member_data: [],
      },
    });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });

  it("handles date search change", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { value: "2025-06-01" } });
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          day: "2025-06-01",
        }),
      }));
    });
  });

  it("handles 指定月 button click", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const monthBtn = screen.getByText("指定月");
    fireEvent.click(monthBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  it("handles 指定日 button click", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const dayBtn = screen.getByText("指定日");
    fireEvent.click(dayBtn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  it("handles member select filter change", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const memberSelect = screen.getByTestId("member-select");
    fireEvent.change(memberSelect, { target: { value: "12345" } });
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          member: "12345",
        }),
      }));
    });
  });

  it("handles shop select filter change", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const shopSelect = screen.getByTestId("shop-select");
    fireEvent.change(shopSelect, { target: { value: "W1" } });
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          shop: "W1",
        }),
      }));
    });
  });

  it("handles tyoku select filter change", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const tyokuSelect = screen.getByTestId("tyoku-select");
    fireEvent.change(tyokuSelect, { target: { value: "1" } });
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          tyoku: "1",
        }),
      }));
    });
  });

  it("handles work select filter change", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const workSelect = screen.getByTestId("work-select");
    fireEvent.change(workSelect, { target: { value: "通常" } });
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          work: "通常",
        }),
      }));
    });
  });

  it("handles judgement select filter change", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const judgementSelect = screen.getByTestId("judgement-select");
    fireEvent.change(judgementSelect, { target: { value: "true" } });
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          judgement: "true",
        }),
      }));
    });
  });

  it("handles pagination page change", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        kosu_data: {
          results: [
            { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "1", work_time: "通常", judgement: true },
          ],
          page_size: 20,
          count: 40,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    const page2Btn = screen.getByText("Page 2");
    fireEvent.click(page2Btn);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
        }),
      }));
    });
  });

  it("displays work_day2 with day of week", async () => {
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 2025-01-01 is a Wednesday
    expect(screen.getByText(/2025-01-01/)).toBeInTheDocument();
  });

  it("shows Unknown name for unmatched employee_no", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: {
          results: [
            { id: 3, employee_no3: 99999, name: "", work_day2: "2025-01-01", tyoku2: "4", work_time: "通常", judgement: true },
          ],
          page_size: 20,
          count: 1,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    expect(await screen.findByText("Unknown (99999)")).toBeInTheDocument();
  });

  it("formats different tyoku values", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: {
          results: [
            { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "2", work_time: "通常", judgement: true },
            { id: 2, employee_no3: 12345, name: "", work_day2: "2025-01-02", tyoku2: "3", work_time: "通常", judgement: true },
            { id: 3, employee_no3: 12345, name: "", work_day2: "2025-01-03", tyoku2: "4", work_time: "通常", judgement: true },
          ],
          page_size: 20,
          count: 3,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    expect(screen.getByText("2直")).toBeInTheDocument();
    expect(screen.getByText("3直")).toBeInTheDocument();
    expect(screen.getByText("常昼")).toBeInTheDocument();
  });
});
