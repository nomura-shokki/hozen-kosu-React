import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import DefDelete from "../../DefinitionPage/DefDelete";

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

describe("DefDelete Component", () => {
  const mockResponse = {
    data: {
      kosu_name: "Ver1",
      kosu_title_1: "作業A",
      kosu_division_1_1: "定義A",
      kosu_division_2_1: "内容A",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("工数区分定義削除の見出しと定義データが表示されること", async () => {
    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数区分定義削除")).toBeInTheDocument();
    expect(screen.getByText("Ver1")).toBeInTheDocument();
    expect(screen.getByText(/作業A/)).toBeInTheDocument();
  });

  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    await screen.findByText("Ver1");
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/def_delete/1/")
      );
    });

    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/def-menu");
  });

  it("確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    await screen.findByText("Ver1");
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
