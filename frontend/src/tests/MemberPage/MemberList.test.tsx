import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import MemberList from "../../MemberPage/MemberList";

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
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option><option value="P">P</option></select> }));

describe("MemberList Component", () => {
  const mockData = {
    data: {
      results: [
        { employee_no: 101, name: "太郎", shop: "P", authority: true, administrator: false },
      ],
      count: 1,
      page_size: 20,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockData);
  });

  it("テーブルヘッダーとデータが正しく表示されること", async () => {
    render(
      <MemoryRouter>
        <MemberList />
      </MemoryRouter>
    );

    expect(await screen.findByText("太郎")).toBeInTheDocument();
    expect(screen.getByText("従業員番号")).toBeInTheDocument();
    expect(screen.getByText("氏名")).toBeInTheDocument();
    expect(screen.getByText("ショップ")).toBeInTheDocument();
  });

  it("権限の有無が正しく表示されること", async () => {
    render(
      <MemoryRouter>
        <MemberList />
      </MemoryRouter>
    );

    await screen.findByText("太郎");
    // authority=true -> "有", administrator=false -> "無"
    const cells = screen.getAllByText("有");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    const noCells = screen.getAllByText("無");
    expect(noCells.length).toBeGreaterThanOrEqual(1);
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <MemberList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("403エラー時に/へリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403, data: { message: "Forbidden" } },
    });

    render(
      <MemoryRouter>
        <MemberList />
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
        <MemberList />
      </MemoryRouter>
    );

    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });
});
