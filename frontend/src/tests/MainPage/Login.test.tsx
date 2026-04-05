import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import Login from "../../MainPage/Login";

// モック設定
vi.mock("../../img/TitleRogo.png", () => ({ default: "logo.png" }));

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

describe("Login Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ログイン見出しと従業員番号入力欄が表示されること", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByLabelText("従業員番号")).toBeInTheDocument();
  });

  it("ログイン成功時に / へ遷移すること", async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { status: "success" },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "12345" } });

    const button = screen.getByRole("button", { name: "ログイン" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("ログイン失敗時にエラーメッセージが表示されること", async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { status: "error", message: "従業員が見つかりません" },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "99999" } });

    const button = screen.getByRole("button", { name: "ログイン" });
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "従業員が見つかりません"
    );
  });

  it("401エラー時に /login へ遷移すること", async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "12345" } });

    const button = screen.getByRole("button", { name: "ログイン" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("401以外のAPIエラー時にレスポンスのエラーメッセージが表示されること", async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("サーバーエラー");
  });
});
