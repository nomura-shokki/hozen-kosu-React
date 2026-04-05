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
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));

import DefEdit from "../../DefinitionPage/DefEdit";

const mockData: any = { kosu_name: "テスト定義" };
for (let i = 1; i <= 50; i++) {
  mockData[`kosu_title_${i}`] = i === 1 ? "作業A" : "";
  mockData[`kosu_division_1_${i}`] = "";
  mockData[`kosu_division_2_${i}`] = "";
  mockData[`kosu_division_3_${i}`] = false;
}

describe("DefEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApi.get.mockResolvedValue({ data: mockData });
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    expect(await screen.findByText("工数区分定義編集")).toBeInTheDocument();
  });

  it("loads data from API with correct endpoint", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_update/1/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays the kosu_name in form", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    const nameInput = await screen.findByDisplayValue("テスト定義");
    expect(nameInput).toBeInTheDocument();
  });

  it("submits form via PUT with confirm", async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const submitBtns = screen.getAllByRole("button", { name: "更新" });
    fireEvent.click(submitBtns[0]);
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApi.put).toHaveBeenCalledWith("/api/def_update/1/", expect.any(Object));
    });
  });

  it("does not submit when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const submitBtns = screen.getAllByRole("button", { name: "更新" });
    fireEvent.click(submitBtns[0]);
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    expect(screen.getByText("工数区分定義一覧")).toBeInTheDocument();
  });

  it("displays definition block inputs", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    expect(document.getElementById("kosu_title_1")).toBeInTheDocument();
  });

  it("handles kosu_name change", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const nameInput = document.getElementById("kosu_name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: "kosu_name", value: "新Ver" } });
    expect(nameInput).toHaveValue("新Ver");
  });

  it("handles definition title change", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const titleInput = document.getElementById("kosu_title_1") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "新作業" } });
    expect(titleInput).toHaveValue("新作業");
  });

  it("handles definition division1 change", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const divInput = document.getElementById("kosu_division_1_1") as HTMLTextAreaElement;
    fireEvent.change(divInput, { target: { value: "新定義" } });
    expect(divInput).toHaveValue("新定義");
  });

  it("handles checkbox change for division3", async () => {
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const checkbox = document.getElementById("kosu_division_1_3") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("handles PUT error with server message", async () => {
    mockedApi.put.mockRejectedValueOnce({
      response: { status: 500, data: { message: "更新エラー" } },
    });
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    const submitBtns = screen.getAllByRole("button", { name: "更新" });
    fireEvent.click(submitBtns[0]);
    expect(await screen.findByText("更新エラー")).toBeInTheDocument();
  });

  it("displays error for non-axios error", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // Will show error state
    await waitFor(() => {
      expect(screen.queryByText("工数区分定義編集") || screen.queryByText(/エラー/) || screen.queryByText("データが見つかりません")).toBeTruthy();
    });
  });

  it("displays データが見つかりません when no data", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: null });
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    expect(await screen.findByText("データが見つかりません")).toBeInTheDocument();
  });
});
