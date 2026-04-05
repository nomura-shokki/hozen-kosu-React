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

import DefSearch from "../../DefinitionPage/DefSearch";

const mockResponse = {
  data: [
    { id: 1, kosu_title_1: "作業A", kosu_division_1_1: "定義A", kosu_division_2_1: "内容A" },
  ],
};

describe("DefSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    expect(await screen.findByText("工数区分定義確認")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_search/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays default definition text", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    expect(await screen.findByText("該当する定義がありません")).toBeInTheDocument();
    expect(screen.getByText("該当する作業内容がありません")).toBeInTheDocument();
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    expect(screen.getByText("工数区分定義MENU")).toBeInTheDocument();
  });

  it("displays select dropdown", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    expect(screen.getByLabelText("定義確認する工数区分選択:")).toBeInTheDocument();
  });

  it("displays options from division data", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    expect(screen.getByText("作業A")).toBeInTheDocument();
  });

  it("selects a division and shows definition", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    const select = screen.getByLabelText("定義確認する工数区分選択:");
    fireEvent.change(select, { target: { value: "作業A" } });
    expect(screen.getByText("定義A")).toBeInTheDocument();
    expect(screen.getByText("内容A")).toBeInTheDocument();
  });

  it("resets definition when selecting empty option", async () => {
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    const select = screen.getByLabelText("定義確認する工数区分選択:");
    fireEvent.change(select, { target: { value: "作業A" } });
    fireEvent.change(select, { target: { value: "" } });
    expect(screen.getByText("該当する定義がありません")).toBeInTheDocument();
  });

  it("displays server error message", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("displays non-axios error", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("handles empty divisions array", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    expect(screen.getByText("データが存在しません")).toBeInTheDocument();
  });
});
