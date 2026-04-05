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
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ employee_no: "12345" }) };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

import MemberEdit from "../../MemberPage/MemberEdit";

const mockMember = {
  data: {
    employee_no: 12345,
    name: "テスト太郎",
    shop: "W1",
    authority: true,
    administrator: false,
    break_time1: "#00000000",
    break_time1_over1: "#00000000",
    break_time1_over2: "#00000000",
    break_time1_over3: "#00000000",
    break_time2: "#00000000",
    break_time2_over1: "#00000000",
    break_time2_over2: "#00000000",
    break_time2_over3: "#00000000",
    break_time3: "#00000000",
    break_time3_over1: "#00000000",
    break_time3_over2: "#00000000",
    break_time3_over3: "#00000000",
    break_time4: "#00000000",
    break_time4_over1: "#00000000",
    break_time4_over2: "#00000000",
    break_time4_over3: "#00000000",
    break_time5: "#00000000",
    break_time5_over1: "#00000000",
    break_time5_over2: "#00000000",
    break_time5_over3: "#00000000",
    break_time6: "#00000000",
    break_time6_over1: "#00000000",
    break_time6_over2: "#00000000",
    break_time6_over3: "#00000000",
    pop_up1: "", pop_up_id1: "", pop_up2: "", pop_up_id2: "",
    pop_up3: "", pop_up_id3: "", pop_up4: "", pop_up_id4: "",
    pop_up5: "", pop_up_id5: "",
    break_check: false,
    def_prediction: false,
  },
};

describe("MemberEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockMember);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    expect(await screen.findByText("人員データ編集")).toBeInTheDocument();
  });

  it("loads data from API with correct endpoint", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/member_update/12345/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays member name in form", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    const nameInput = await screen.findByDisplayValue("テスト太郎");
    expect(nameInput).toBeInTheDocument();
  });

  it("submits form data via PUT", async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/member_update/12345/", expect.any(Object));
    });
  });

  it("displays employee number in form", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    expect(await screen.findByDisplayValue("12345")).toBeInTheDocument();
  });

  it("displays navigation link", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    expect(screen.getByText("人員一覧")).toBeInTheDocument();
  });

  it("displays authority checkbox", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    expect(screen.getByLabelText("権限:")).toBeInTheDocument();
  });

  it("handles checkbox change", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    const authorityCheckbox = screen.getByLabelText("権限:");
    fireEvent.click(authorityCheckbox);
    expect(authorityCheckbox).not.toBeChecked();
  });

  it("handles text input change", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    const nameInput = screen.getByLabelText("氏名:");
    fireEvent.change(nameInput, { target: { name: "name", value: "新しい名前" } });
    expect(nameInput).toHaveValue("新しい名前");
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("handles PUT error with 401", async () => {
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("shows shop select component", async () => {
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    expect(screen.getByTestId("shop-select")).toBeInTheDocument();
  });
});
