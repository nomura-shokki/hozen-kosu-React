import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import AdministratorMenu from "../../AdministratorPage/AdministratorMenu";

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

describe("AdministratorMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("管理者MENUの見出しとリンクが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter>
        <AdministratorMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
    expect(screen.getByText("設定変更")).toBeInTheDocument();
    expect(screen.getByText("データ管理")).toBeInTheDocument();
    expect(screen.getByText("全工数データ管理")).toBeInTheDocument();
    expect(screen.getByText("非同期タスクデータ管理")).toBeInTheDocument();
    expect(screen.getByText("データ操作履歴管理")).toBeInTheDocument();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <AdministratorMenu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("403エラー時に/へリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403 },
    });

    render(
      <MemoryRouter>
        <AdministratorMenu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
