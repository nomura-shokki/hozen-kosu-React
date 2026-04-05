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
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));

import DefDetailEdit from "../../DefinitionPage/DefDetailEdit";

const mockResponse = {
  data: {
    formData: { id: 1, def_symbol: "A", def_select: "作業詳細A" },
    symbol_list: ["A", "B", "C"],
  },
};

describe("DefDetailEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    expect(await screen.findByText("作業詳細選択肢編集")).toBeInTheDocument();
  });

  it("loads data from API with correct endpoint", async () => {
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_update/1/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays form with loaded data", async () => {
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    expect(await screen.findByDisplayValue("作業詳細A")).toBeInTheDocument();
  });

  it("submits form via PUT", async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    await screen.findByText("作業詳細選択肢編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/def_detail_update/1/", expect.any(Object));
    });
  });
});
