import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import InquirNew from "../../InquirPage/InquirNew";

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

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/ItemSelect", () => ({
  default: (props: any) => (
    <select data-testid="item-select" onChange={props.onChange} value={props.value}>
      <option value="">---</option>
      <option value="要望">要望</option>
    </select>
  ),
}));

describe("InquirNew Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  it("問い合わせの見出しが表示されること", async () => {
    render(
      <MemoryRouter>
        <InquirNew />
      </MemoryRouter>
    );

    expect(await screen.findByText("問い合わせ")).toBeInTheDocument();
  });

  it("フォーム送信でPOSTが呼ばれアラートが表示されること", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter>
        <InquirNew />
      </MemoryRouter>
    );

    await screen.findByText("問い合わせ");

    const textarea = screen.getByLabelText("問い合わせ：");
    fireEvent.change(textarea, { target: { value: "テスト問い合わせ" } });

    const submitButton = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/inquir_new/"),
        expect.any(Object)
      );
    });

    expect(window.alert).toHaveBeenCalledWith("登録完了！");
  });

  it("401エラー時にログインにリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("403エラー時にメインにリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("サーバーエラーメッセージが表示されること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  it("ナビゲーションリンクが表示されること", async () => {
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    expect(screen.getByText("問い合わせMENU")).toBeInTheDocument();
  });

  it("内容選択セレクトが表示されること", async () => {
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    expect(screen.getByTestId("item-select")).toBeInTheDocument();
  });

  it("POST送信時の401エラーでログインにリダイレクトすること", async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    const textarea = screen.getByLabelText("問い合わせ：");
    fireEvent.change(textarea, { target: { value: "テスト" } });
    const submitButton = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("非Axiosエラー時にエラーメッセージが表示されること", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("内容選択の変更が反映されること", async () => {
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    const select = screen.getByTestId("item-select");
    fireEvent.change(select, { target: { value: "要望" } });
    expect(select).toHaveValue("要望");
  });
});
