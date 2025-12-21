import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; 
import KosuList from "../../KosuPage/KosuList";

// axiosのモック化
vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(),
      isAxiosError: vi.fn((err) => !!err.isAxiosError), // isAxiosErrorプロパティがあればtrueを返す
    },
  };
});

// 型定義エラーを回避
const mockedAxios = axios as any;

// navigateのモック化
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe("KosuList Component", () => {
  const mockData = {
    data: {
      results: [
        {
          id: 1,
          employee_no3: 12345,
          name: "テスト太郎",
          work_day2: "2023-10-01",
          tyoku2: "1",
          judgement: true,
        },
      ],
      count: 1,
      page_size: 20,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期表示時にデータを取得して表示すること", async () => {
    mockedAxios.get.mockResolvedValueOnce(mockData);

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    // データがレンダリングされるのを待つ
    await waitFor(() => {
      expect(screen.getByText("工数履歴")).toBeInTheDocument();
      expect(screen.getByText(/2023-10-01/)).toBeInTheDocument();
      expect(screen.getByText("1直")).toBeInTheDocument();
      expect(screen.getByText("OK")).toBeInTheDocument();
    });
  });

  it("APIエラー（401）時にログイン画面へリダイレクトすること", async () => {
    // axios.isAxiosErrorがtrueを返し、statusが401であるオブジェクトを模倣
    mockedAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    await waitFor(() => {
      // navigate("/login") が呼ばれたか検証
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("データが空の場合にメッセージが表示されること", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { results: [], count: 0, page_size: 20 },
    });

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No data found.")).toBeInTheDocument();
    });
  });

  it("日付を指定して検索ができること", async () => {
    mockedAxios.get.mockResolvedValue(mockData);

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    // 日付入力を変更
    const dateInput = screen.getByLabelText(/就業日：/);
    fireEvent.change(dateInput, { target: { value: "2023-12-22" } });

    // 指定日ボタンをクリック
    const searchButton = screen.getByText("指定日");
    fireEvent.click(searchButton);

    await waitFor(() => {
      // APIリクエストに正しいパラメータが含まれているか検証
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            day: "2023-12-22",
            mode: "day"
          })
        })
      );
    });
  });
});