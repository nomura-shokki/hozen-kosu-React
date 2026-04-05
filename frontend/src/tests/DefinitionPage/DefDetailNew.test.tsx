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

import DefDetailNew from "../../DefinitionPage/DefDetailNew";

const mockResponse = {
  data: {
    kosu_title_1: "作業A",
    kosu_title_2: "作業B",
  },
};

describe("DefDetailNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    expect(await screen.findByText("作業詳細選択肢登録")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_new/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("submits form via POST", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    await screen.findByText("作業詳細選択肢登録");
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_detail_new/", expect.any(Object));
    });
  });
});
