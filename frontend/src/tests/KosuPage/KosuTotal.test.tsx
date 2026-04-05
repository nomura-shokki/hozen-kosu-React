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
vi.mock("react-chartjs-2", () => ({ Bar: () => <div data-testid="bar-chart">Chart</div> }));
vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
}));
vi.mock("chartjs-plugin-datalabels", () => ({ default: {} }));

import KosuTotal from "../../KosuPage/KosuTotal";

const mockResponse = {
  data: {
    member_data: {},
    kosu_data: { time_work: "A".repeat(12) },
    def_data: { kosu_title_1: "作業A" },
    session_day: "2025-01-01",
  },
};

describe("KosuTotal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
    mockedApi.post.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    expect(await screen.findByText("工数集計")).toBeInTheDocument();
  });

  it("loads initial data from API", async () => {
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_total/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("renders chart component", async () => {
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    expect(await screen.findByTestId("bar-chart")).toBeInTheDocument();
  });
});
