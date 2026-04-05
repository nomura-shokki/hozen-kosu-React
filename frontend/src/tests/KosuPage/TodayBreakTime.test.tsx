import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@mui/x-date-pickers", () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
  MobileTimePicker: (props: any) => <input data-testid="time-picker" />,
}));
vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({ AdapterDateFns: class {} }));

import TodayBreakTime from "../../KosuPage/TodayBreakTime";

const mockResponse = {
  data: {
    kosu_data: {
      employee_no3: 12345,
      work_day2: "2025-01-01",
      breaktime: "#12001300",
      breaktime_over1: "#00000000",
      breaktime_over2: "#00000000",
      breaktime_over3: "#00000000",
    },
    session_day: "2025-01-01",
  },
};

describe("TodayBreakTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading with date", async () => {
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    expect(await screen.findByText(/休憩時間変更/)).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/today_break_time/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("navigates to /kosu-new on 400 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 400 } });
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/kosu-new");
    });
  });

  it("displays break time labels", async () => {
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    expect(await screen.findByText("昼休憩:")).toBeInTheDocument();
    expect(screen.getByText("残業休憩1:")).toBeInTheDocument();
  });
});
