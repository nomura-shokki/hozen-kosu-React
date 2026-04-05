import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));

import KosuCalendar from "../../KosuPage/KosuCalendar";

const mockResponse = {
  data: {
    kosu_data: [
      {
        id: 1,
        employee_no3: 12345,
        name: "テスト太郎",
        work_day2: "2025-01-15",
        tyoku2: "1",
        work_time: "通常",
        time_work: "#".repeat(288),
        judgement: true,
        over_time: "60",
      },
    ],
    session_year: 2025,
    session_month: 1,
  },
};

describe("KosuCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    expect(await screen.findByText("勤務入力")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_calendar/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays total overtime", async () => {
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    expect(await screen.findByText("合計残業時間: 1.00H")).toBeInTheDocument();
  });

  it("posts work write on button click", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    await screen.findByText("勤務入力");
    const btn = screen.getByText("勤務登録");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/kosu_work_write/", expect.any(Object));
    });
  });
});
