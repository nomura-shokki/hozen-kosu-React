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

import TeamCalendar from "../../TeamPage/TeamCalendar";

const mockResponse = {
  data: {
    kosu_data: [],
    Search_day: "2025-01-15",
    member_name_list: [[12345, "テスト太郎"]],
  },
};

describe("TeamCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    expect(await screen.findByText("班員工数入力状況")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_calendar/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays member names", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    expect(screen.getByText("班員MENU")).toBeInTheDocument();
  });

  it("displays date input", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    expect(screen.getByLabelText("日付選択:")).toBeInTheDocument();
  });

  it("displays search button", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    expect(screen.getByRole("button", { name: "検索" })).toBeInTheDocument();
  });

  it("displays week navigation buttons", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    expect(screen.getByRole("button", { name: "前週" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次週" })).toBeInTheDocument();
  });

  it("displays weekday headers", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    expect(screen.getByText("日")).toBeInTheDocument();
    expect(screen.getByText("月")).toBeInTheDocument();
    expect(screen.getByText("土")).toBeInTheDocument();
  });

  it("displays member rows with 勤務, 残業, 入力時間", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    expect(screen.getByText("勤務")).toBeInTheDocument();
    expect(screen.getByText("残業(分)")).toBeInTheDocument();
    expect(screen.getByText("入力時間")).toBeInTheDocument();
  });

  it("handles search button click", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    const searchBtn = screen.getByRole("button", { name: "検索" });
    fireEvent.click(searchBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_calendar/", expect.any(Object));
    });
  });

  it("handles 前週 button click", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    const prevBtn = screen.getByRole("button", { name: "前週" });
    fireEvent.click(prevBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_calendar_week_jump/", { week: "B" });
    });
  });

  it("handles 次週 button click", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    const nextBtn = screen.getByRole("button", { name: "次週" });
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_calendar_week_jump/", { week: "A" });
    });
  });

  it("handles date input change", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    const dateInput = screen.getByLabelText("日付選択:");
    fireEvent.change(dateInput, { target: { value: "2025-06-15" } });
    expect(dateInput).toHaveValue("2025-06-15");
  });

  it("handles window resize", async () => {
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("班員工数入力状況")).toBeInTheDocument();
  });

  it("displays error state", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("displays kosu data with time_work", async () => {
    const timeWork = "A".repeat(60) + "#".repeat(168) + "B".repeat(60);
    const dataWithKosu = {
      data: {
        kosu_data: [
          { id: 1, employee_no3: 12345, name: "テスト太郎", work_day2: "2025-01-15", tyoku2: "1", work_time: "通常", time_work: timeWork, judgement: true, over_time: "30" },
        ],
        Search_day: "2025-01-15",
        member_name_list: [[12345, "テスト太郎"]],
      },
    };
    mockedApi.get.mockResolvedValueOnce(dataWithKosu);
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    expect(screen.getByText("通常")).toBeInTheDocument();
  });
});
