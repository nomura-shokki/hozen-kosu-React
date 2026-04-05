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
vi.mock("@mui/x-date-pickers", () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
  MobileTimePicker: (props: any) => <input data-testid="time-picker" />,
}));
vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({ AdapterDateFns: class {} }));

import BreakTime from "../../KosuPage/BreakTime";

const mockResponse = {
  data: {
    member_data: {
      employee_no: 12345,
      name: "テスト太郎",
      shop: "W1",
      authority: true,
      administrator: false,
      break_time1: "#06300700",
      break_time1_over1: "#00000000",
      break_time1_over2: "#00000000",
      break_time1_over3: "#00000000",
      break_time2: "#11101140",
      break_time2_over1: "#00000000",
      break_time2_over2: "#00000000",
      break_time2_over3: "#00000000",
      break_time3: "#19502020",
      break_time3_over1: "#00000000",
      break_time3_over2: "#00000000",
      break_time3_over3: "#00000000",
      break_time4: "#12001300",
      break_time4_over1: "#00000000",
      break_time4_over2: "#00000000",
      break_time4_over3: "#00000000",
      break_time5: "#06300700",
      break_time5_over1: "#00000000",
      break_time5_over2: "#00000000",
      break_time5_over3: "#00000000",
      break_time6: "#17101740",
      break_time6_over1: "#00000000",
      break_time6_over2: "#00000000",
      break_time6_over3: "#00000000",
    },
  },
};

describe("BreakTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    expect(await screen.findByText("休憩時間変更")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/break_time/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays break time labels", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    expect(await screen.findByText("1直")).toBeInTheDocument();
    expect(screen.getByText("2直")).toBeInTheDocument();
    expect(screen.getByText("3直")).toBeInTheDocument();
  });

  it("displays all shift labels", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("1直");
    expect(screen.getByText("常昼")).toBeInTheDocument();
    expect(screen.getByText("連1直")).toBeInTheDocument();
    expect(screen.getByText("連2直")).toBeInTheDocument();
  });

  it("displays break sub-labels", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("1直");
    const lunchLabels = screen.getAllByText(/昼休憩/);
    expect(lunchLabels.length).toBeGreaterThanOrEqual(6);
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    expect(screen.getByText("工数MENU")).toBeInTheDocument();
  });

  it("displays description text", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    expect(screen.getByText(/毎日の休憩時間が変更されます/)).toBeInTheDocument();
  });

  it("displays submit button", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    expect(screen.getByRole("button", { name: "登録" })).toBeInTheDocument();
  });

  it("submits form via POST", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/break_time/", expect.any(Object));
    });
  });

  it("displays error for non-401 API error", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  it("displays error for non-axios error", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("handles empty member_data", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { member_data: {} } });
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    expect(await screen.findByText("休憩時間変更")).toBeInTheDocument();
  });

  it("renders time pickers", async () => {
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    const timePickers = screen.getAllByTestId("time-picker");
    expect(timePickers.length).toBeGreaterThanOrEqual(48);
  });
});
