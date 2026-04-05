import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import DefList from "../../DefinitionPage/DefList";

vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
import api from "../../api/axios";
const mockedApi = api as any;

vi.mock("axios", () => ({
  default: {
    isAxiosError: vi.fn((err) => !!err.response),
  },
}));

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));

describe("DefList Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("工数区分定義一覧とテーブルデータが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { results: [{ id: 1, kosu_name: "Ver1" }], count: 1, page_size: 20 },
    });

    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数区分定義一覧")).toBeInTheDocument();
    expect(screen.getByText("Ver1")).toBeInTheDocument();
  });

  it("編集・削除リンクが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { results: [{ id: 1, kosu_name: "Ver1" }], count: 1, page_size: 20 },
    });

    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    await screen.findByText("Ver1");
    const editLinks = screen.getAllByText("編集");
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
    const deleteLinks = screen.getAllByText("削除");
    expect(deleteLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("403エラー時に/へリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403, data: { message: "Forbidden" } },
    });

    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("データが空の場合にNo data found.が表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { results: [], count: 0, page_size: 20 },
    });

    render(
      <MemoryRouter>
        <DefList />
      </MemoryRouter>
    );

    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });
});
