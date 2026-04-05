import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import AdministratorTaskList from "../../AdministratorPage/AdministratorTaskList";

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

describe("AdministratorTaskList Component", () => {
  const mockResponse = {
    data: {
      task_data: {
        results: [
          {
            id: 1,
            task_id: "abc-123",
            status: "success",
            result: "",
            created_at: "2023-10-25T10:30:00",
            updated_at: "2023-10-25T10:35:00",
          },
        ],
        count: 1,
        page_size: 20,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("テーブルにタスクデータが表示されること", async () => {
    render(
      <MemoryRouter>
        <AdministratorTaskList />
      </MemoryRouter>
    );

    expect(await screen.findByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });

  it("タイムスタンプがフォーマットされて表示されること", async () => {
    render(
      <MemoryRouter>
        <AdministratorTaskList />
      </MemoryRouter>
    );

    expect(await screen.findByText("2023-10-25 (10:30)")).toBeInTheDocument();
  });
});
