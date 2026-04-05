import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import TeamDetail from "../../TeamPage/TeamDetail";

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
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    useParams: () => ({ id: "1" }),
  };
});

vi.mock("../../Components/KosuBarChart", () => ({
  default: () => <div data-testid="mock-bar-chart">Chart Mock</div>,
}));
vi.mock("../../Components/KosuDisplay", () => ({
  default: (props: any) => <div data-testid="mock-display">{props.shop}</div>,
}));
vi.mock("../../Components/DefTable", () => ({
  default: () => <div data-testid="mock-def-table">Table Mock</div>,
}));
vi.mock("../../Components/Loading", () => ({ default: () => null }));

describe("TeamDetail Component", () => {
  const mockResponse = {
    data: {
      kosu_data: {
        employee_no3: 101,
        name: "太郎",
        work_day2: "2023-10-25",
        tyoku2: "1",
        time_work: "A",
        detail_work: "",
        over_time: 60,
        work_time: "出勤",
        def_ver2: "v1",
        judgement: true,
        break_change: false,
      },
      def_data: {},
      member_data: { employee_no: 101, name: "太郎", shop: "P" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("フォーマットされた日付が表示されること", async () => {
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText("2023年10月25日(水)")).toBeInTheDocument();
  });

  it("氏名が表示されること", async () => {
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText(/太郎/)).toBeInTheDocument();
  });

  it("直が正しく表示されること", async () => {
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText(/1直/)).toBeInTheDocument();
  });

  it("残業時間が正しく表示されること", async () => {
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText(/1\.00H/)).toBeInTheDocument();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <TeamDetail />
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
        <TeamDetail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
