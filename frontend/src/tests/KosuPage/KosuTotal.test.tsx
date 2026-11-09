/**
 * ============================================================
 * ファイル名 : KosuTotal.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuTotal.tsx（工数集計画面）
 * 概要       : 見出しの表示・初期データ取得API呼び出し・401時の遷移・棒グラフ部品の表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/login）を記録して確認するため
 *   - Loading                      : 読み込み中表示は確認対象外のため何も表示しない部品にする
 *   - react-chartjs-2 / chart.js / chartjs-plugin-datalabels : テスト環境（jsdom）では
 *                                    canvas によるグラフ描画ができないため、描画を伴わない偽物に置き換える
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする

// ============================================================
// モック定義
// ============================================================

// api（共通axiosインスタンス）のモック: get/post/put/delete をすべて「何もしない偽の関数」に置き換える
vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from "../../api/axios";
// モック関数のメソッド（mockResolvedValue など）を型エラーなしで呼ぶため any として扱う
const mockedApi = api as any;

// axios.isAxiosError のモック: response プロパティを持つエラーなら true（通信エラー扱い）を返す
vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
}));

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  // Link や MemoryRouter など、それ以外の機能は本物をそのまま使う
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// Loading（読み込み中表示）のモック: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// react-chartjs-2 のモック: 棒グラフ（Bar）を testid="bar-chart" の div に置き換え、表示されたかだけを確認できるようにする
vi.mock("react-chartjs-2", () => ({ Bar: () => <div data-testid="bar-chart">Chart</div> }));
// chart.js のモック: 画面側で行う部品の登録（Chart.register）を何もしない関数にし、
// 登録対象の各部品（軸・棒・タイトル・吹き出し・凡例）は中身のない空のクラスにする
vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
}));
// chartjs-plugin-datalabels（棒の上に数値を表示する追加機能）のモック: 空のオブジェクトにする
vi.mock("chartjs-plugin-datalabels", () => ({ default: {} }));

// テスト対象の画面（モック定義の後に読み込む）
import KosuTotal from "../../KosuPage/KosuTotal";

// ============================================================
// テスト用データ
// ============================================================

// GET / POST /api/kosu_total/ のレスポンス例
//   kosu_data.time_work: 作業内容。"A"（1番目の工数区分「作業A」）が12枠 = 12 × 5分 = 60分
//   session_day: 集計の基準日。GET でこの値を受け取ると、その日付で POST して集計し直す
const mockResponse = {
  data: {
    member_data: {},
    kosu_data: { time_work: "A".repeat(12) },
    def_data: { kosu_title_1: "作業A" },
    session_day: "2025-01-01",
  },
};

// ============================================================
// テスト本体
// ============================================================

// KosuTotal 画面の表示・データ取得・エラー処理・グラフ表示をまとめて確認するテストグループ
describe("KosuTotal", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、GET（初期表示）と POST（基準日での集計）の
  // どちらも上記の工数データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
    mockedApi.post.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面見出し「工数集計」が表示されること
  //   前提: GET・POST とも工数データを返す
  //   操作: 画面を表示する
  //   期待: 「工数集計」という見出しがある
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数集計")).toBeInTheDocument();
  });

  // 【テスト】初期表示で工数集計用の初期データ取得APIが呼ばれること
  //   前提: GET・POST とも工数データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/kosu_total/" で呼ばれる
  it("loads initial data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    // 検証: GET /api/kosu_total/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_total/");
    });
  });

  // 【テスト】初期データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: GET は1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目の GET を 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】集計結果の棒グラフ部品が表示されること
  //   前提: GET・POST とも工数データを返す
  //   操作: 画面を表示する
  //   期待: 棒グラフ（モックの bar-chart）が表示される
  it("renders chart component", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuTotal /></MemoryRouter>);
    // 検証: 棒グラフが表示されるまで待って確認する
    expect(await screen.findByTestId("bar-chart")).toBeInTheDocument();
  });
});
