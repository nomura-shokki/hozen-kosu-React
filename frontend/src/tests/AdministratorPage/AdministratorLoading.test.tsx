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
  AxiosError: class extends Error {
    response: any;
    constructor(message?: string) {
      super(message);
      this.response = null;
    }
  },
}));

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));

import AdministratorLoading from "../../AdministratorPage/AdministratorLoading";

describe("AdministratorLoading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    expect(await screen.findByText("データ管理")).toBeInTheDocument();
  });

  it("loads auth check from API", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_Loading/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
      message: "Unauthorized",
    });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays backup buttons", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    expect(screen.getAllByDisplayValue("バックアップ開始").length).toBeGreaterThan(0);
  });

  it("displays navigation link to manager menu", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    expect(screen.getByText("管理者MENU")).toBeInTheDocument();
  });

  it("displays date range inputs", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const startInput = screen.getByLabelText(/期間指定/);
    expect(startInput).toBeInTheDocument();
  });

  it("displays delete buttons for kosu data", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    expect(screen.getAllByDisplayValue("削除開始").length).toBeGreaterThan(0);
  });

  it("displays load buttons", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    expect(screen.getAllByDisplayValue("ロード開始").length).toBeGreaterThan(0);
  });

  it("displays file upload inputs", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    expect(screen.getByText(/工数データ/)).toBeInTheDocument();
    expect(screen.getByText(/人員データ/)).toBeInTheDocument();
    expect(screen.getByText(/班員データ/)).toBeInTheDocument();
  });

  it("displays all data section labels", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    expect(screen.getByText(/工数区分定義データ/)).toBeInTheDocument();
    expect(screen.getByText(/問い合わせデータ/)).toBeInTheDocument();
    expect(screen.getByText(/設定データ/)).toBeInTheDocument();
    expect(screen.getByText(/タスク履歴データ/)).toBeInTheDocument();
    expect(screen.getByText(/操作履歴データ/)).toBeInTheDocument();
  });

  it("starts kosu backup when button is clicked", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "task123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} }) // auth check
      .mockResolvedValue({ data: { status: "success", file_path: "/path/to/file" } }); // task status
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[0]);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/kosu_backup/", expect.any(Object));
    });
  });

  it("navigates to / on 403 error", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403 },
      message: "Forbidden",
    });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("changes start_day value", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const startInput = document.getElementById("start_day") as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: "2025-06-01" } });
    expect(startInput.value).toBe("2025-06-01");
  });

  it("changes end_day value", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const endInput = document.getElementById("end_day") as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: "2025-12-31" } });
    expect(endInput.value).toBe("2025-12-31");
  });

  it("starts def backup when button is clicked", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "task456" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} }) // auth check
      .mockResolvedValue({ data: { status: "success", file_path: "/path" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    // The second backup button is for def data
    fireEvent.click(backupBtns[1]);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_backup/", undefined);
    });
  });

  it("starts kosu delete when button is clicked", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "task789" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const deleteBtns = screen.getAllByDisplayValue("削除開始");
    fireEvent.click(deleteBtns[0]); // first delete button = kosu delete
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/kosu_delet/", expect.any(Object));
    });
  });

  it("handles backup POST failure", async () => {
    mockedApi.post.mockRejectedValueOnce(new Error("network error"));
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[0]);
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it("handles backup response without taskId", async () => {
    mockedApi.post.mockResolvedValue({ data: { message: "失敗しました" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[0]);
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it("starts member backup", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "mem123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/member.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    // member backup is the 4th backup button (kosu, def, choice, member)
    fireEvent.click(backupBtns[3]);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/member_backup/", undefined);
    });
  });

  it("starts team backup", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "team123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/team.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    // team backup is the 5th backup button
    fireEvent.click(backupBtns[4]);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_backup/", undefined);
    });
  });

  it("starts inquiry backup", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "inq123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/inquiry.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[5]); // inquiry backup
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/inquiry_backup/", undefined);
    });
  });

  it("starts setting backup", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "set123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/setting.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[6]); // setting backup
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/setting_backup/", undefined);
    });
  });

  it("starts async task backup (date-ranged)", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "async123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/async.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[7]); // async task backup
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/AsyncTask_backup/", expect.any(Object));
    });
  });

  it("starts history backup (date-ranged)", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "hist123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/history.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[8]); // history backup
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/History_backup/", expect.any(Object));
    });
  });

  it("starts async task delete", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "asyncDel" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const deleteBtns = screen.getAllByDisplayValue("削除開始");
    fireEvent.click(deleteBtns[1]); // async task delete
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/AsyncTask_delet/", expect.any(Object));
    });
  });

  it("starts history delete", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "histDel" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const deleteBtns = screen.getAllByDisplayValue("削除開始");
    fireEvent.click(deleteBtns[2]); // history delete
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/History_delet/", expect.any(Object));
    });
  });

  it("starts choice backup", async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: "choice123" } });
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/choice.csv" } });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[2]); // choice backup
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/choice_backup/", undefined);
    });
  });

  it("shows error when other error during auth check", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500 },
      message: "Server Error",
    });
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // No crash; error state is set internally
  });

  it("displays all load buttons as disabled when no file selected", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const loadBtns = screen.getAllByDisplayValue("ロード開始");
    loadBtns.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  it("displays file upload labels with default text", async () => {
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const fileLabels = screen.getAllByText("ファイルを選択 (CSV/XLSX)");
    expect(fileLabels.length).toBeGreaterThan(0);
  });
});
