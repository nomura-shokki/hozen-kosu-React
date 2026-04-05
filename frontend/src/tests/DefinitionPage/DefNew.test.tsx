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

import DefNew from "../../DefinitionPage/DefNew";

describe("DefNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    expect(await screen.findByText("工数区分定義登録")).toBeInTheDocument();
  });

  it("loads auth check from API", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_new/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("submits form via POST with confirm", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const submitBtns = screen.getAllByRole("button", { name: "登録" });
    fireEvent.click(submitBtns[0]);
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_new/", expect.any(Object));
    });
  });

  it("does not submit when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const submitBtns = screen.getAllByRole("button", { name: "登録" });
    fireEvent.click(submitBtns[0]);
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    expect(screen.getByText("工数区分定義MENU")).toBeInTheDocument();
  });

  it("displays kosu_name input", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    expect(document.getElementById("kosu_name")).toBeInTheDocument();
  });

  it("handles kosu_name change", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const nameInput = document.getElementById("kosu_name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: "kosu_name", value: "テストVer" } });
    expect(nameInput).toHaveValue("テストVer");
  });

  it("displays definition block inputs", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    expect(document.getElementById("kosu_title_1")).toBeInTheDocument();
  });

  it("handles definition title change", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const titleInput = document.getElementById("kosu_title_1") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "作業名テスト" } });
    expect(titleInput).toHaveValue("作業名テスト");
  });

  it("handles POST error with server message", async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: "登録エラー" } },
    });
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const submitBtns = screen.getAllByRole("button", { name: "登録" });
    fireEvent.click(submitBtns[0]);
    expect(await screen.findByText("登録エラー")).toBeInTheDocument();
  });

  it("displays non-axios error message", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("handles division1 textarea change", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const div1Input = document.getElementById("kosu_division_1_1") as HTMLTextAreaElement;
    fireEvent.change(div1Input, { target: { value: "テスト定義" } });
    expect(div1Input).toHaveValue("テスト定義");
  });

  it("handles checkbox change for division3", async () => {
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    const checkbox = document.getElementById("kosu_division_1_3") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
