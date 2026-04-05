import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import TaskDetail from "../../AdministratorPage/AdministratorTaskDetail";

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
    useParams: () => ({ id: "1" }),
  };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));

describe("AdministratorTaskDetail Component", () => {
  const mockResponse = {
    data: {
      task_data: {
        id: 1,
        task_id: "abc-123",
        status: "success",
        result: "完了",
        created_at: "2023-10-25",
        updated_at: "2023-10-25",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("タスク詳細が表示されること", async () => {
    render(
      <MemoryRouter>
        <TaskDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("完了")).toBeInTheDocument();
    expect(screen.getByText("タスクID")).toBeInTheDocument();
    expect(screen.getByText("状態")).toBeInTheDocument();
    expect(screen.getByText("結果")).toBeInTheDocument();
  });

  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <TaskDetail />
      </MemoryRouter>
    );

    await screen.findByText("abc-123");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/manager_task_detail/1/")
      );
    });

    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/manager-task");
  });

  it("確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <TaskDetail />
      </MemoryRouter>
    );

    await screen.findByText("abc-123");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockedApi.delete).not.toHaveBeenCalled();
  });
});
