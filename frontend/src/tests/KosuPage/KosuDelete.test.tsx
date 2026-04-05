import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import KosuDelete from "../../KosuPage/KosuDelete";

// 1. api (カスタムaxiosインスタンス) のモック
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

// axios.isAxiosError のモック
vi.mock("axios", () => ({
  default: {
    isAxiosError: vi.fn((err: any) => !!err.response),
  },
}));

// 2. 子コンポーネントを強制的に「空のdiv」に置き換える
vi.mock("../../Components/KosuBarChart", () => ({
  default: () => <div data-testid="mock-bar-chart">Chart Mock</div>
}));
vi.mock("../../Components/KosuDisplay", () => ({
  default: (props: any) => <div data-testid="mock-display">{props.shop}</div>
}));
vi.mock("../../Components/DefTable", () => ({
  default: () => <div data-testid="mock-def-table">Table Mock</div>
}));
vi.mock("../../Components/Loading", () => ({
  default: () => null
}));

// 3. react-router-dom のモック
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    useParams: () => ({ id: "123" }),
  };
});


const mockResponseData = {
  data: {
    kosu_data: {
      id: "123",
      work_day2: "2023-10-25",
      tyoku2: "1",
      time_work: "08:00-17:00",
      detail_work: "通常業務",
      over_time: 1.5,
      work_time: "08:00",
      judgement: true,
    },
    def_data: { "A-1": "作業A" },
    member_data: { shop: "加工SHOP" },
  },
};

describe("KosuDelete Component - 削除機能テスト", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});

    // getリクエストのデフォルト挙動を設定
    mockedApi.get.mockResolvedValue(mockResponseData);
  });

  it("初期表示時にAPIからデータを取得し、正しく表示されること", async () => {
    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    // データの読み込みを待つ
    expect(await screen.findByText("2023-10-25")).toBeInTheDocument();

    // 子コンポーネントがモックに置き換わっているか確認
    const displayMock = await screen.findByTestId("mock-display");
    expect(displayMock).toHaveTextContent("加工SHOP");
    expect(screen.getByTestId("mock-bar-chart")).toBeInTheDocument();
  });

  it("削除ボタンをクリックし、確認ダイアログでOKを押すと削除APIが呼ばれること", async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    await screen.findByText("2023-10-25");

    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        "/api/kosu_delete/123/"
      );
    });

    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/kosu-list");
  });

  it("確認ダイアログでキャンセルを押した場合、削除APIは呼ばれないこと", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    await screen.findByText("2023-10-25");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  it("API取得エラー（401）時にログイン画面へリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
