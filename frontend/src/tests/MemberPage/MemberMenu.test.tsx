import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import MemberMenu from "../../MemberPage/MemberMenu";

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

describe("MemberMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("人員MENUの見出しとリンクが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter>
        <MemberMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("人員MENU")).toBeInTheDocument();
    expect(screen.getByText("人員登録")).toBeInTheDocument();
    expect(screen.getByText("人員一覧")).toBeInTheDocument();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <MemberMenu />
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
        <MemberMenu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
