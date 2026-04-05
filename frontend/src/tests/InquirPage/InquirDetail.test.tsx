import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import InquirDetail from "../../InquirPage/InquirDetail";

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

vi.mock("../../Components/Loading", () => ({ default: () => null }));

describe("InquirDetail Component", () => {
  const mockResponse = {
    data: {
      inquir_data: {
        employee_no2: 101,
        content_choice: "要望",
        inquiry: "テスト",
        answer: "回答",
      },
      login_data: {
        employee_no: 101,
        name: "太郎",
        shop: "P",
        authority: true,
        administrator: true,
      },
      inquir_member_data: {
        employee_no: 101,
        name: "太郎",
      },
      next_id: 2,
      before_id: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("問い合わせ詳細の見出しと内容が表示されること", async () => {
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText("問い合わせ詳細")).toBeInTheDocument();
    expect(screen.getByText("テスト")).toBeInTheDocument();
    expect(screen.getByText("回答")).toBeInTheDocument();
  });

  it("管理者の場合に編集リンクが表示されること", async () => {
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText("編集")).toBeInTheDocument();
  });

  it("next_idがある場合に次へボタンが表示され、before_idがnullの場合に前へボタンが非表示であること", async () => {
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText(/次へ/)).toBeInTheDocument();
    expect(screen.queryByText(/前へ/)).not.toBeInTheDocument();
  });

  it("before_idがある場合に前へボタンが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        next_id: null,
        before_id: 1,
      },
    });

    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText(/前へ/)).toBeInTheDocument();
    expect(screen.queryByText(/次へ/)).not.toBeInTheDocument();
  });

  it("非管理者かつ非作成者の場合に編集リンクが非表示であること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        inquir_data: {
          employee_no2: 999,
          content_choice: "要望",
          inquiry: "テスト",
          answer: "回答",
        },
        login_data: {
          employee_no: 101,
          name: "太郎",
          shop: "P",
          authority: false,
          administrator: false,
        },
        inquir_member_data: { employee_no: 999, name: "他者" },
        next_id: null,
        before_id: null,
      },
    });

    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    await screen.findByText("問い合わせ詳細");
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
  });
});
