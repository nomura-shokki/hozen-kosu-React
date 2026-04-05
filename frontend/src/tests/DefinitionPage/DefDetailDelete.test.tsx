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

import DefDetailDelete from "../../DefinitionPage/DefDetailDelete";

const mockResponse = {
  data: {
    formData: { id: 1, def_symbol: "A", def_select: "作業詳細A" },
    symbol_list: ["A", "B", "C"],
  },
};

describe("DefDetailDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    expect(await screen.findByText("作業詳細選択肢削除")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_update/1/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays record data", async () => {
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    expect(await screen.findByText("作業詳細A")).toBeInTheDocument();
  });

  it("deletes record on button click", async () => {
    mockedApi.delete.mockResolvedValue({});
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    await screen.findByText("作業詳細A");
    const deleteBtn = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith("/api/def_detail_delete/1/");
    });
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/def-detail-list");
  });
});
