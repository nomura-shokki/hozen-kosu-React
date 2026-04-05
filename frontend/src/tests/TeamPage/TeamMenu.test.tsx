import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import TeamMenu from "../../TeamPage/TeamMenu";

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
    useLocation: () => ({ pathname: "/team-menu", state: null }),
  };
});

describe("TeamMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("班員MENUの見出しとメニューリンクが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { follow_message_list: [], member_data: {} },
    });

    render(
      <MemoryRouter>
        <TeamMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("班員MENU")).toBeInTheDocument();
    expect(screen.getByText("班員登録")).toBeInTheDocument();
    expect(screen.getByText("班員工数履歴")).toBeInTheDocument();
    expect(screen.getByText("班員工数入力状況")).toBeInTheDocument();
    expect(screen.getByText("班員残業")).toBeInTheDocument();
  });

  it("お知らせメッセージが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { follow_message_list: ["お知らせテスト"], member_data: {} },
    });

    render(
      <MemoryRouter>
        <TeamMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("お知らせ")).toBeInTheDocument();
    expect(screen.getByText("お知らせテスト")).toBeInTheDocument();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <TeamMenu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
