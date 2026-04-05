import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import MemberDelete from "../../MemberPage/MemberDelete";

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
    useParams: () => ({ employee_no: "12345" }),
  };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));

describe("MemberDelete Component", () => {
  const mockMember = {
    data: {
      employee_no: 12345,
      name: "太郎",
      shop: "P",
      authority: true,
      administrator: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockMember);
  });

  it("人員データがテーブルに表示されること", async () => {
    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    expect(await screen.findByText("太郎")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    await screen.findByText("太郎");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/member_delete/12345/")
      );
    });

    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/member-list");
  });

  it("確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    await screen.findByText("太郎");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
