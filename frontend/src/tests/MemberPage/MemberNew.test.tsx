import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from "../../api/axios";
const mockedApi = api as any;

vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
}));

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

import MemberNew from "../../MemberPage/MemberNew";

describe("MemberNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    expect(await screen.findByText("人員登録")).toBeInTheDocument();
  });

  it("loads auth check from API", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/member_new/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("submits form data via POST", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/member_new/", expect.any(Object));
    });
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    expect(screen.getByText("人員MENU")).toBeInTheDocument();
  });

  it("displays form fields", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    expect(screen.getByLabelText("従業員番号:")).toBeInTheDocument();
    expect(screen.getByLabelText("氏名:")).toBeInTheDocument();
    expect(screen.getByLabelText("権限:")).toBeInTheDocument();
    expect(screen.getByLabelText("管理者権限:")).toBeInTheDocument();
  });

  it("handles text input change", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    const nameInput = screen.getByLabelText("氏名:");
    fireEvent.change(nameInput, { target: { name: "name", value: "テスト" } });
    expect(nameInput).toHaveValue("テスト");
  });

  it("handles checkbox change", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    const authorityCheckbox = screen.getByLabelText("権限:");
    fireEvent.click(authorityCheckbox);
    expect(authorityCheckbox).toBeChecked();
  });

  it("handles POST error with 401", async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("handles POST error with server message", async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  it("shows shop select component", async () => {
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    expect(screen.getByTestId("shop-select")).toBeInTheDocument();
  });

  it("displays error for non-axios error on auth", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });
});
