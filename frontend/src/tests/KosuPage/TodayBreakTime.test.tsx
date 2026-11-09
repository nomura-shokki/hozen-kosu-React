/**
 * ============================================================
 * ファイル名 : TodayBreakTime.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/TodayBreakTime.tsx（当日休憩時間変更画面）
 * 概要       : 工数入力中の就業日1日分だけ休憩時間を変更する画面について、見出しの表示・データ取得・
 *              エラー時の遷移（401→ログイン画面、400→工数入力画面）・休憩の入力ラベル表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/login・/kosu-new）を記録して確認するため
 *   - Loading                      : 読み込み中表示は確認対象外のため何も表示しない部品にする
 *   - @mui/x-date-pickers（MobileTimePicker 等） : 本物の時刻入力部品は操作が複雑なため、
 *                                    data-testid="time-picker" を持つただの input に置き換える
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
// MUI の日付・時刻部品のモック
//   LocalizationProvider: 中身をそのまま表示するだけの入れ物にする
//   MobileTimePicker: 受け取った props は使わず、testid 付きの input を表示する
vi.mock("@mui/x-date-pickers", () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
  MobileTimePicker: (props: any) => <input data-testid="time-picker" />,
}));
// AdapterDateFns（日付ライブラリとの橋渡し役）のモック: 中身のない空のクラスにする
vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({ AdapterDateFns: class {} }));

// テスト対象の画面（モック定義の後に読み込む）
import TodayBreakTime from "../../KosuPage/TodayBreakTime";

// ============================================================
// テスト用データ
// ============================================================

// GET /api/today_break_time/ のレスポンス例（対象就業日の工数データの休憩時間）
//   休憩時間は "#HHMMHHMM" 形式（例: "#12001300" = 12:00〜13:00）。"#00000000" は未設定扱い
//   breaktime = 昼休憩、breaktime_over1〜3 = 残業休憩1〜3
//   session_day: 対象の就業日（サーバーのセッションに保存された値）。見出しに表示される
const mockResponse = {
  data: {
    kosu_data: {
      employee_no3: 12345,
      work_day2: "2025-01-01",
      breaktime: "#12001300",
      breaktime_over1: "#00000000",
      breaktime_over2: "#00000000",
      breaktime_over3: "#00000000",
    },
    session_day: "2025-01-01",
  },
};

// ============================================================
// テスト本体
// ============================================================

// TodayBreakTime 画面の表示・データ取得・エラー時の遷移をまとめて確認するテストグループ
describe("TodayBreakTime", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert（登録完了時に出る）を無効化し、
  // APIは常に上記の休憩時間データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】見出し（就業日 + 「休憩時間変更」）が表示されること
  //   前提: APIは就業日 2025-01-01 の休憩時間データを返す
  //   操作: 画面を表示する
  //   期待: 「休憩時間変更」を含む見出しがある（日付部分の表示内容までは確認しない）
  it("displays the heading with date", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    // 検証: 見出しは「日付」と「休憩時間変更」が改行（<br />）でつながっているため、正規表現で部分一致検索する
    expect(await screen.findByText(/休憩時間変更/)).toBeInTheDocument();
  });

  // 【テスト】初期表示で当日休憩時間の取得APIが呼ばれること
  //   前提: APIは休憩時間データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/today_break_time/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    // 検証: GET /api/today_break_time/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/today_break_time/");
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
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】APIが400を返したら工数入力画面へ戻ること
  //   前提: APIは1回目の呼び出しで status 400 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/kosu-new") が呼ばれる
  it("navigates to /kosu-new on 400 error", async () => {
    // 準備: 1回目のAPI呼び出しを 400 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 400 } });
    // 操作: 画面を表示
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    // 検証: 工数入力画面（"/kosu-new"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/kosu-new");
    });
  });

  // 【テスト】休憩の入力ラベル（昼休憩・残業休憩1）が表示されること
  //   前提: APIは休憩時間データを返す
  //   操作: 画面を表示する
  //   期待: 「昼休憩:」「残業休憩1:」というラベルがある
  it("displays break time labels", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TodayBreakTime /></MemoryRouter>);
    // 検証: 読み込み完了を「昼休憩:」の表示で待ち、続けて「残業休憩1:」も確認する
    expect(await screen.findByText("昼休憩:")).toBeInTheDocument();
    expect(screen.getByText("残業休憩1:")).toBeInTheDocument();
  });
});
