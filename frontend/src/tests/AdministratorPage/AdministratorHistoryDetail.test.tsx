import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import HistoryDetail from "../../AdministratorPage/AdministratorHistoryDetail";

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

describe("AdministratorHistoryDetail Component", () => {
  const mockResponse = {
    data: {
      history_data: {
        id: 1,
        operation: "UPDATE",
        table_name: "member",
        record_id: "101",
        login_No: "12345",
        changes: "{'name': {'old': '太郎', 'new': '次郎'}}",
        timestamp: "2023-10-25 10:30:00",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("履歴詳細が表示されること", async () => {
    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText("データ操作履歴詳細")).toBeInTheDocument();
    expect(screen.getByText("UPDATE")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("操作種類")).toBeInTheDocument();
    expect(screen.getByText("テーブル名")).toBeInTheDocument();
  });

  it("変更内容がold/newフォーマットで表示されること", async () => {
    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    await screen.findByText("データ操作履歴詳細");
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText(/太郎/)).toBeInTheDocument();
    expect(screen.getByText(/次郎/)).toBeInTheDocument();
  });

  it("削除ボタンクリックで確認OK時にDELETEが呼ばれること", async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    await screen.findByText("データ操作履歴詳細");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/manager_history_detail/1/")
      );
    });

    expect(window.alert).toHaveBeenCalledWith("削除しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/manager-history");
  });

  it("空の変更内容の場合に変更なしが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        history_data: {
          id: 2,
          operation: "CREATE",
          table_name: "member",
          record_id: "102",
          login_No: "12345",
          changes: "",
          timestamp: "2023-10-25 11:00:00",
        },
      },
    });

    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    expect(await screen.findByText("変更なし")).toBeInTheDocument();
  });
});
