/**
 * ============================================================
 * ファイル名 : KosuCalendar.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuCalendar.tsx（勤務入力画面＝月カレンダー形式の就業形態・直の入力画面）
 * 概要       : 初期表示・データ取得・401時の遷移・合計残業時間の表示・「勤務登録」ボタンの送信を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/login など）を記録して確認するため
 *   - Loading / TyokuSelect / WorkSelect : 画面の本質と関係ない子部品を単純な select 等に置き換えるため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TyokuSelect（直の選択欄）: 選択肢「---」だけを持つ簡易 select にする（value と onChange は受け渡す）
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
// WorkSelect（就業形態の選択欄）: 選択肢「---」だけを持つ簡易 select にする（value と onChange は受け渡す）
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));

// テスト対象の画面（モック定義の後に読み込む）
import KosuCalendar from "../../KosuPage/KosuCalendar";

// ============================================================
// テスト用データ
// ============================================================

// GET /api/kosu_calendar/ のレスポンス例（2025年1月の工数データ1件）
//   time_work: 1日を5分刻み288枠（24時間×12）で表す作業内容。"#" は作業なしの枠
//   over_time: 残業時間（分）。"60" = 60分 = 1.00H
//   session_year / session_month: カレンダーに表示する年・月（サーバーのセッションに保存された値）
const mockResponse = {
  data: {
    kosu_data: [
      {
        id: 1,
        employee_no3: 12345,
        name: "テスト太郎",
        work_day2: "2025-01-15",
        tyoku2: "1",
        work_time: "通常",
        time_work: "#".repeat(288),
        judgement: true,
        over_time: "60",
      },
    ],
    session_year: 2025,
    session_month: 1,
  },
};

// ============================================================
// テスト本体
// ============================================================

// KosuCalendar 画面の表示・データ取得・残業集計・勤務登録をまとめて確認するテストグループ
describe("KosuCalendar", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert を無効化し、
  // APIは常に上記の工数データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面見出し「勤務入力」が表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 「勤務入力」という見出しがある
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("勤務入力")).toBeInTheDocument();
  });

  // 【テスト】初期表示でカレンダー用の工数取得APIが呼ばれること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/kosu_calendar/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    // 検証: GET /api/kosu_calendar/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_calendar/");
    });
  });

  // 【テスト】APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】月内の残業時間の合計が時間単位（小数2桁）で表示されること
  //   前提: 工数データ1件の残業時間が60分
  //   操作: 画面を表示する
  //   期待: 「合計残業時間: 1.00H」と表示される（60分 ÷ 60 = 1.00時間）
  it("displays total overtime", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    // 検証: 分を時間に換算した合計が表示される
    expect(await screen.findByText("合計残業時間: 1.00H")).toBeInTheDocument();
  });

  // 【テスト】「勤務登録」ボタンで入力中の就業形態・直がPOST送信されること
  //   前提: POSTは成功を返す
  //   操作: 画面表示後に「勤務登録」をクリック
  //   期待: api.post が "/api/kosu_work_write/" と送信データ（日付ごとの入力内容）付きで呼ばれる
  it("posts work write on button click", async () => {
    // 準備: POST は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuCalendar /></MemoryRouter>);
    await screen.findByText("勤務入力");
    // 操作: 「勤務登録」ボタンをクリック
    const btn = screen.getByText("勤務登録");
    fireEvent.click(btn);
    // 検証: POST /api/kosu_work_write/ が呼ばれる（送信内容の中身までは確認しない）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/kosu_work_write/", expect.any(Object));
    });
  });
});
