import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; 
import KosuList from "../../KosuPage/KosuList";

/**
 * axiosのグローバルなモック化
 * Vitestのvi.mockを使用して、実際のHTTPリクエストが発生しないように制御します。
 */
vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(),
      // axios.isAxiosError(err) メソッドをモック化
      // テスト内で発生させた擬似エラーオブジェクトをAxiosErrorとして認識させるための判定ロジック
      isAxiosError: vi.fn((err) => !!err.isAxiosError),
    },
  };
});

// TypeScriptの型チェックを回避し、モック化されたメソッドにアクセスしやすくするためのエイリアス
const mockedAxios = axios as any;

/**
 * react-router-dom の useNavigate をモック化
 * 画面遷移（リダイレクト）が正しく行われたかを追跡するため、
 * 実際のリダイレクトを停止して jest.fn() に置き換えます。
 */
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual, // 他のコンポーネント（Link等）はオリジナルのまま使用
    useNavigate: () => mockedNavigate,
  };
});

describe("KosuList Component - 結合テスト", () => {
  // テスト全体で使用する正常系のダミーデータ
  const mockData = {
    data: {
      results: [
        {
          id: 1,
          employee_no3: 12345,
          name: "テスト太郎",
          work_day2: "2023-10-01",
          tyoku2: "1",      // 1直
          judgement: true,  // OK判定
        },
      ],
      count: 1,
      page_size: 20,
    },
  };

  /**
   * 各テストケース実行前のクリーンアップ処理
   * モックの呼び出し履歴をリセットし、テスト間の干渉を防ぎます。
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期表示時にデータを取得して表示すること", async () => {
    // 1. axios.get が正常なデータを返すように設定
    mockedAxios.get.mockResolvedValueOnce(mockData);

    // 2. コンポーネントをレンダリング（ルーティングを擬似的に再現）
    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    // 3. 非同期処理（useEffect内のfetch）が完了してDOMが更新されるのを待機
    await waitFor(() => {
      // 画面上に特定の文字列が存在するかを確認
      expect(screen.getByText("工数履歴")).toBeInTheDocument();
      expect(screen.getByText(/2023-10-01/)).toBeInTheDocument();
      expect(screen.getByText("1直")).toBeInTheDocument();
      expect(screen.getByText("OK")).toBeInTheDocument();
    });
  });

  it("APIエラー（401 Unauthorized）時にログイン画面へリダイレクトすること", async () => {
    // 1. axios.get が 401エラーをスローするように設定
    mockedAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    // 2. navigate関数が "/login" という引数で呼ばれたことを検証
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("データが空の場合にメッセージが表示されること", async () => {
    // 1. レコード件数 0 件のレスポンスをモック
    mockedAxios.get.mockResolvedValueOnce({
      data: { results: [], count: 0, page_size: 20 },
    });

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    // 2. コンポーネント内の 0件時用メッセージが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText("No data found.")).toBeInTheDocument();
    });
  });

  it("日付を指定して検索ができること", async () => {
    // 全てのgetリクエストに対し正常データを返す設定
    mockedAxios.get.mockResolvedValue(mockData);

    render(
      <MemoryRouter>
        <KosuList />
      </MemoryRouter>
    );

    // 1. 日付入力フィールド（label要素に関連付けられたinput）を特定し、値を入力
    const dateInput = screen.getByLabelText(/就業日：/);
    fireEvent.change(dateInput, { target: { value: "2023-12-22" } });

    // 2. 検索実行（指定日ボタン）をクリック
    const searchButton = screen.getByText("指定日");
    fireEvent.click(searchButton);

    /**
     * 3. axios.get の呼び出し引数を検証
     * URLは何でも良い（expect.any(String)）が、
     * クエリパラメータ（params）に日付(day)と検索モード(mode)が正しく渡されているかを確認
     */
    await waitFor(() => {
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