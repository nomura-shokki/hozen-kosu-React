import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

import TeamView from "../../TeamPage/TeamView";

const mockResponse = {
  data: {
    kosu_data: [],
    member_name_list: [[12345, "テスト太郎"]],
    session_year: 2025,
    session_month: 1,
    shop_default: "W1",
  },
};

describe("TeamView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    expect(await screen.findByText("工数入力状況(全体)")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_view/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays member names", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
  });

  it("displays Excel export button", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    expect(await screen.findByText("Excelに出力")).toBeInTheDocument();
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    expect(screen.getByText("班員MENU")).toBeInTheDocument();
  });

  it("displays shop select", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    expect(screen.getByTestId("shop-select")).toBeInTheDocument();
  });

  it("displays year and month selectors", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    expect(screen.getByText("2025年")).toBeInTheDocument();
    expect(screen.getByText("1月")).toBeInTheDocument();
  });

  it("displays date column headers", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // January has 31 days
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
  });

  it("displays NG by default for member with no kosu data", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    const ngCells = screen.getAllByText("NG");
    expect(ngCells.length).toBeGreaterThan(0);
  });

  it("displays OK for member with matching kosu data", async () => {
    const dataWithKosu = {
      data: {
        ...mockResponse.data,
        kosu_data: [
          { id: 1, employee_no3: 12345, name: "テスト太郎", work_day2: "2025-01-15", tyoku2: "1", work_time: "通常", time_work: "A", judgement: true, over_time: "30" },
        ],
      },
    };
    mockedApi.get.mockResolvedValueOnce(dataWithKosu);
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    const okCells = screen.getAllByText("OK");
    expect(okCells.length).toBeGreaterThan(0);
  });

  it("changes year via select", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    const yearSelect = screen.getByDisplayValue("2025年");
    fireEvent.change(yearSelect, { target: { name: "year", value: "2024" } });
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_view/", expect.objectContaining({ year: 2024 }));
    });
  });

  it("changes month via select", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    const monthSelect = screen.getByDisplayValue("1月");
    fireEvent.change(monthSelect, { target: { name: "month", value: "6" } });
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_view/", expect.objectContaining({ month: 6 }));
    });
  });

  it("handles window resize", async () => {
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("工数入力状況(全体)")).toBeInTheDocument();
  });

  it("displays error state", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("handles shop select change", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    const shopSelect = screen.getByTestId("shop-select");
    fireEvent.change(shopSelect, { target: { name: "shop1", value: "A1" } });
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_shop_select/", expect.any(Object));
    });
  });

  it("handles Excel export click", async () => {
    mockedApi.post.mockResolvedValue({ data: new Blob() });
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    const exportBtn = screen.getByText("Excelに出力");
    fireEvent.click(exportBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_export/", expect.any(Object), expect.any(Object));
    });
  });
});
