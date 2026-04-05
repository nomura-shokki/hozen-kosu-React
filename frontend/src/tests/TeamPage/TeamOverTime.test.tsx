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

import TeamOverTime from "../../TeamPage/TeamOverTime";

const mockResponse = {
  data: {
    kosu_data: [],
    member_name_list: [[12345, "テスト太郎"]],
    session_year: 2025,
    session_month: 1,
  },
};

describe("TeamOverTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    expect(await screen.findByText("班員工数入力状況")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_overtime/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays member names and total column", async () => {
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
    expect(screen.getByText("合計")).toBeInTheDocument();
  });
});
