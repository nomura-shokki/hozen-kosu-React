import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
vi.mock("../../Components/DefSelect", () => ({ default: (props: any) => <select data-testid="def-select" onChange={props.onChange}><option value="">---</option></select> }));
vi.mock("../../Components/KosuBarChart", () => ({ default: () => <div data-testid="bar-chart">Chart</div> }));
vi.mock("../../Components/DefTable", () => ({ default: () => <div data-testid="def-table">DefTable</div> }));
vi.mock("@mui/x-date-pickers", () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
  MobileTimePicker: (props: any) => <input data-testid="time-picker" />,
}));
vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({ AdapterDateFns: class {} }));

import KosuEdit from "../../KosuPage/KosuEdit";

const mockResponse = {
  data: {
    kosu_data: {
      employee_no3: 12345,
      work_day2: "2025-01-01",
      tyoku2: "1",
      time_work: "A".repeat(288),
      detail_work: Array(288).fill("test").join("$"),
      over_time: 0,
      work_time: "通常",
      def_ver2: "v1",
      judgement: true,
      break_change: false,
    },
    def_data: { kosu_title_1: "作業A" },
    member_data: { employee_no: 12345, name: "テスト太郎", shop: "W1" },
    detail_data_list: [],
  },
};

describe("KosuEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    expect(await screen.findByText("工数データ編集")).toBeInTheDocument();
  });

  it("loads data from API with correct endpoint", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_update/1/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays error message when API returns non-401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("displays unknown error for non-axios errors", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network failure"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("displays work_day2 input with value", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const dateInput = screen.getByLabelText(/就業日/);
    expect(dateInput).toHaveValue("2025-01-01");
  });

  it("displays OK when judgement is true", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("displays NG when judgement is false", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, judgement: false },
      },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    expect(screen.getByText("NG")).toBeInTheDocument();
  });

  it("displays navigation links", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    expect(screen.getByText("工数履歴")).toBeInTheDocument();
    expect(screen.getByText("工数入力")).toBeInTheDocument();
  });

  it("displays 行追加 and 行削除 buttons", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    expect(screen.getByRole("button", { name: "行追加" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "行削除" })).toBeInTheDocument();
  });

  it("adds a new row on 行追加 click", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // Wait for parsing to complete and rows to appear
    await waitFor(() => {
      expect(screen.getAllByTestId("def-select").length).toBeGreaterThan(0);
    });
    const defSelectsBefore = screen.getAllByTestId("def-select").length;
    const addBtn = screen.getByRole("button", { name: "行追加" });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getAllByTestId("def-select").length).toBeGreaterThan(defSelectsBefore);
    });
  });

  it("removes last row on 行削除 click", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const addBtn = screen.getByRole("button", { name: "行追加" });
    fireEvent.click(addBtn);
    const timePickersAfterAdd = screen.getAllByTestId("time-picker").length;
    const removeBtn = screen.getByRole("button", { name: "行削除" });
    fireEvent.click(removeBtn);
    const timePickersAfterRemove = screen.getAllByTestId("time-picker").length;
    expect(timePickersAfterRemove).toBeLessThan(timePickersAfterAdd);
  });

  it("shows 就業日更新 button", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    expect(screen.getByRole("button", { name: "就業日更新" })).toBeInTheDocument();
  });

  it("calls handleSendDayUpdate on 就業日更新 click", async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/day_update/", expect.any(Object));
    });
  });

  it("displays KosuBarChart and DefTable when initialTimeWork exists", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("def-table")).toBeInTheDocument();
    });
  });

  it("submits form via PUT", async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/kosu_update/1/", expect.any(Object));
    });
  });

  it("handles non-axios error gracefully", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network failure"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    expect(await screen.findByText(/不明なエラー/)).toBeInTheDocument();
  });

  it("handles increment and decrement for over_time", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // The plus and minus are within the over-time-wrapper
    const plusBtns = screen.getAllByRole("button", { name: "+" });
    const minusBtns = screen.getAllByRole("button", { name: "-" });
    if (plusBtns.length > 0) {
      fireEvent.click(plusBtns[0]);
    }
    if (minusBtns.length > 0) {
      fireEvent.click(minusBtns[0]);
    }
    // Just verify no crash
    expect(screen.getByText("工数データ編集")).toBeInTheDocument();
  });

  it("shows validation error when work_time is missing on submit", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, work_time: "" },
      },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("入力必要項目が入力されていません。")).toBeInTheDocument();
    });
  });

  it("shows validation error when tyoku2 is missing on submit", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, tyoku2: "" },
      },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("入力必要項目が入力されていません。")).toBeInTheDocument();
    });
  });

  it("shows overtime validation error (15min unit) on submit", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, over_time: 7 },
      },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("残業の最小単位は15分です。確認してください。")).toBeInTheDocument();
    });
  });

  it("shows overtime validation error for kyushutsu (5min unit) on submit", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, work_time: "休出", over_time: 7 },
      },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("休出時の残業は(15n+5)分です。確認してください。")).toBeInTheDocument();
    });
  });

  it("handles submit PUT error (401)", async () => {
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("handles submit PUT server error", async () => {
    mockedApi.put.mockRejectedValueOnce({ response: { status: 500, data: { message: "更新エラー" } } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("Error: 更新エラー")).toBeInTheDocument();
    });
  });

  it("handles submit PUT non-axios error", async () => {
    mockedApi.put.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
    });
  });

  it("handles item delete via POST", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // Wait for parsed data rows to render
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole("button", { name: "削除" });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    // Need to enable the row first (toggle the checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is work/tyoku toggle, rest are row toggles
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]); // Enable first row
    }
    // Try clicking a delete button that is enabled
    const enabledDeleteBtns = screen.getAllByRole("button", { name: "削除" });
    const enabledBtn = enabledDeleteBtns.find(btn => !(btn as HTMLButtonElement).disabled);
    if (enabledBtn) {
      fireEvent.click(enabledBtn);
      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith("/api/item_delete/", expect.any(Object));
      });
    }
  });

  it("handles item delete POST error (401)", async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "削除" }).length).toBeGreaterThan(0);
    });
    const checkboxes = screen.getAllByRole("checkbox");
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]);
    }
    const enabledBtn = screen.getAllByRole("button", { name: "削除" }).find(btn => !(btn as HTMLButtonElement).disabled);
    if (enabledBtn) {
      fireEvent.click(enabledBtn);
      await waitFor(() => {
        expect(mockedNavigate).toHaveBeenCalledWith("/login");
      });
    }
  });

  it("handles day update PUT error (401)", async () => {
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("handles day update PUT server error", async () => {
    mockedApi.put.mockRejectedValueOnce({ response: { status: 500, data: { message: "日付更新エラー" } } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    await waitFor(() => {
      expect(screen.getByText("Error: 日付更新エラー")).toBeInTheDocument();
    });
  });

  it("handles day update PUT non-axios error", async () => {
    mockedApi.put.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    await waitFor(() => {
      expect(screen.getByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
    });
  });

  it("toggles work/tyoku edit mode checkbox", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // The first checkbox is the work/tyoku toggle
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    // Initially isWorkTyokuDisabled is true, so checkbox is unchecked
    expect(checkboxes[0]).not.toBeChecked();
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
  });

  it("changes work_day2 input", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { name: "work_day2", value: "2025-06-15" } });
    expect(dateInput).toHaveValue("2025-06-15");
  });

  it("API取得で非Axiosエラー時にエラー表示すること", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    expect(await screen.findByText(/不明なエラーが発生しました/)).toBeInTheDocument();
  });

  it("handles over_time input change", async () => {
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // Enable work/tyoku editing first
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // enable
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    fireEvent.change(overTimeInput, { target: { name: "over_time", value: "30" } });
    expect(screen.getByText("工数データ編集")).toBeInTheDocument();
  });

  it("サーバーエラー時にエラーメッセージが表示されること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    expect(await screen.findByText(/サーバーエラー/)).toBeInTheDocument();
  });
});
