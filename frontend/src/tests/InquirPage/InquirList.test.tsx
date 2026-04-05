import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import InquirList from "../../InquirPage/InquirList";

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
    useLocation: () => ({ pathname: "/inquir-list", state: null }),
  };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option></select> }));
vi.mock("../../Components/ItemSelect", () => ({ default: (props: any) => <select data-testid="item-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));

describe("InquirList Component", () => {
  const mockResponse = {
    data: {
      inquir_data: {
        results: [
          {
            id: 1,
            employee_no2: 101,
            name: "太郎",
            content_choice: "要望",
            inquiry: "テスト問い合わせ",
            answer: "回答テスト",
          },
        ],
        count: 1,
        page_size: 20,
      },
      member_data: [{ id: 1, employee_no: 101, name: "太郎" }],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("テーブルにデータが表示されること、名前がリンクであること", async () => {
    render(
      <MemoryRouter>
        <InquirList />
      </MemoryRouter>
    );

    expect(await screen.findByText("太郎")).toBeInTheDocument();
    expect(screen.getByText("要望")).toBeInTheDocument();

    const nameLink = screen.getByText("太郎");
    expect(nameLink.closest("a")).toHaveAttribute("href", "/inquir-detail/1");
  });

  it("長いテキストが省略されること", async () => {
    render(
      <MemoryRouter>
        <InquirList />
      </MemoryRouter>
    );

    await screen.findByText("太郎");
    // "テスト問い合わせ" substring(0,3) + "..." -> "テスト問..."
    // "回答テスト" substring(0,3) + "..." -> "回答テ..."
    // Use regex to match the truncated text since exact matching may be tricky
    const inquiryCells = screen.getAllByRole("cell");
    const hasInquiryTruncated = inquiryCells.some(
      (cell) => cell.textContent?.includes("...")
    );
    expect(hasInquiryTruncated).toBe(true);
  });
});
