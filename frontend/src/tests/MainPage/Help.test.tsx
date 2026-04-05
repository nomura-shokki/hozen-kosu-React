import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import Help from "../../MainPage/Help";

// APIモック
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

describe("Help Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期表示で認証画面が表示されること", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "認証" })).toBeInTheDocument();
    expect(screen.queryByText("ヘルプ")).not.toBeInTheDocument();
  });

  it("パスワード認証成功後にヘルプ画面が表示されること", async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { result: true },
    });

    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });

    const authButton = screen.getByRole("button", { name: "認証" });
    fireEvent.click(authButton);

    expect(await screen.findByText("ヘルプ")).toBeInTheDocument();
  });

  it("パスワード認証失敗時にエラーメッセージが表示されること", async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { result: false },
    });

    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "wrong" } });

    const authButton = screen.getByRole("button", { name: "認証" });
    fireEvent.click(authButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "認証に失敗しました。"
    );
  });

  it("認証後、memberチェックボックスを選択してリセット実行すると確認ダイアログが表示されAPIが呼ばれること", async () => {
    // 認証成功
    mockedApi.post.mockResolvedValueOnce({
      data: { result: true },
    });

    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 認証フロー
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));

    await screen.findByText("ヘルプ");

    // リセットAPI成功モック
    mockedApi.post.mockResolvedValueOnce({});

    // confirm と alert のモック
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});

    // member-reset チェックボックスを選択
    const memberCheckbox = screen.getByRole("checkbox", { name: /人員データリセット/ });
    fireEvent.click(memberCheckbox);

    // 書き込みボタンをクリック
    const submitButton = screen.getByRole("button", { name: "書き込み" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/api/help//",
        expect.objectContaining({ memberReset: true })
      );
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("12345")
      );
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("チェックボックス未選択で書き込みするとエラーメッセージが表示されること", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { result: true } });

    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));

    await screen.findByText("ヘルプ");

    fireEvent.click(screen.getByRole("button", { name: "書き込み" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "リセットするデータを選択してください。"
    );
  });

  it("確認ダイアログでキャンセルした場合にAPIが呼ばれないこと", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { result: true } });

    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));

    await screen.findByText("ヘルプ");

    vi.spyOn(window, "confirm").mockReturnValueOnce(false);

    const memberCheckbox = screen.getByRole("checkbox", { name: /人員データリセット/ });
    fireEvent.click(memberCheckbox);

    mockedApi.post.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "書き込み" }));

    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
