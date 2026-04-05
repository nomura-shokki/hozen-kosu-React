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
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));

import DefDetailList from "../../DefinitionPage/DefDetailList";

const mockResponse = {
  data: {
    results: [
      { id: 1, def_symbol: "A", def_select: "作業詳細A" },
    ],
    page_size: 20,
    count: 1,
    symbol_list: ["A", "B", "C"],
  },
};

describe("DefDetailList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    expect(await screen.findByText("作業詳細選択肢一覧")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_list/", expect.any(Object));
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays data in table", async () => {
    render(<MemoryRouter><DefDetailList /></MemoryRouter>);
    expect(await screen.findByText("作業詳細A")).toBeInTheDocument();
  });
});
