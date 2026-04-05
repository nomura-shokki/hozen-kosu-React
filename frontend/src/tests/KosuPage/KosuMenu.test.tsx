import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import KosuMenu from "../../KosuPage/KosuMenu";

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

describe("KosuMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("工数MENUの見出しが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { employee_no: 1, name: "太郎" } });

    render(
      <MemoryRouter>
        <KosuMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数MENU")).toBeInTheDocument();
  });

  it("メニューリンクが正しく表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { employee_no: 1, name: "太郎" } });

    render(
      <MemoryRouter>
        <KosuMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数入力")).toBeInTheDocument();
    expect(screen.getByText("工数履歴")).toBeInTheDocument();
    expect(screen.getByText("休憩変更")).toBeInTheDocument();
    expect(screen.getByText("勤務入力")).toBeInTheDocument();
    expect(screen.getByText("工数集計")).toBeInTheDocument();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <KosuMenu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
