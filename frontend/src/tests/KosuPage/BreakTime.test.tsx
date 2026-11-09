/**
 * ============================================================
 * ファイル名 : BreakTime.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/BreakTime.tsx（休憩時間変更画面）
 * 概要       : ログイン者の毎日の休憩時間（直ごと・昼休憩/残業休憩1〜3）を
 *              変更する画面について、初期表示・データ取得・登録送信・エラー時の表示や遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/login など）を記録して確認するため
 *   - Loading                      : 読み込み中表示は確認対象外のため何も表示しない部品にする
 *   - @mui/x-date-pickers（MobileTimePicker 等） : 本物の時刻入力部品は操作が複雑なため、
 *                                    data-testid="time-picker" を持つただの input に置き換える
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
//   MobileTimePicker: 受け取った props は使わず、数を数えられるよう testid 付きの input を表示する
vi.mock("@mui/x-date-pickers", () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
  MobileTimePicker: (props: any) => <input data-testid="time-picker" />,
}));
// AdapterDateFns（日付ライブラリとの橋渡し役）のモック: 中身のない空のクラスにする
vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({ AdapterDateFns: class {} }));

// テスト対象の画面（モック定義の後に読み込む）
import BreakTime from "../../KosuPage/BreakTime";

// ============================================================
// テスト用データ
// ============================================================

// GET /api/break_time/ のレスポンス例（ログイン者の人員データ）
//   休憩時間は "#HHMMHHMM" 形式（例: "#06300700" = 06:30〜07:00）。"#00000000" は未設定扱い
//   break_time1〜6 = 1直/2直/3直/常昼/連1直/連2直 の昼休憩、_over1〜3 = 残業休憩1〜3
const mockResponse = {
  data: {
    member_data: {
      employee_no: 12345,
      name: "テスト太郎",
      shop: "W1",
      authority: true,
      administrator: false,
      break_time1: "#06300700",
      break_time1_over1: "#00000000",
      break_time1_over2: "#00000000",
      break_time1_over3: "#00000000",
      break_time2: "#11101140",
      break_time2_over1: "#00000000",
      break_time2_over2: "#00000000",
      break_time2_over3: "#00000000",
      break_time3: "#19502020",
      break_time3_over1: "#00000000",
      break_time3_over2: "#00000000",
      break_time3_over3: "#00000000",
      break_time4: "#12001300",
      break_time4_over1: "#00000000",
      break_time4_over2: "#00000000",
      break_time4_over3: "#00000000",
      break_time5: "#06300700",
      break_time5_over1: "#00000000",
      break_time5_over2: "#00000000",
      break_time5_over3: "#00000000",
      break_time6: "#17101740",
      break_time6_over1: "#00000000",
      break_time6_over2: "#00000000",
      break_time6_over3: "#00000000",
    },
  },
};

// ============================================================
// テスト本体
// ============================================================

// BreakTime 画面の表示・データ取得・登録・エラー処理をまとめて確認するテストグループ
describe("BreakTime", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert（登録完了時に出る）を無効化し、
  // APIは常に上記の人員データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面見出し「休憩時間変更」が表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「休憩時間変更」という見出しがある
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("休憩時間変更")).toBeInTheDocument();
  });

  // 【テスト】初期表示で休憩時間取得APIが呼ばれること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/break_time/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: GET /api/break_time/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/break_time/");
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
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】直の見出し（1直・2直・3直）が表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「1直」「2直」「3直」の見出しがある
  it("displays break time labels", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: 読み込み完了を「1直」の表示で待ち、続けて2直・3直も確認する
    expect(await screen.findByText("1直")).toBeInTheDocument();
    expect(screen.getByText("2直")).toBeInTheDocument();
    expect(screen.getByText("3直")).toBeInTheDocument();
  });

  // 【テスト】残りの直の見出し（常昼・連1直・連2直）も表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「常昼」「連1直」「連2直」の見出しがある（6種類の直すべてが並ぶ）
  it("displays all shift labels", async () => {
    // 準備: 画面を表示し、読み込み完了を「1直」の表示で待つ
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("1直");
    // 検証: 常昼・連1直・連2直の見出しがある
    expect(screen.getByText("常昼")).toBeInTheDocument();
    expect(screen.getByText("連1直")).toBeInTheDocument();
    expect(screen.getByText("連2直")).toBeInTheDocument();
  });

  // 【テスト】各直に「昼休憩」の入力ラベルが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「昼休憩」を含むラベルが6個以上ある（6種類の直 × 昼休憩1つずつ）
  it("displays break sub-labels", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("1直");
    // 検証: 「昼休憩:」のように表示されるため、正規表現で部分一致検索して数を数える
    const lunchLabels = screen.getAllByText(/昼休憩/);
    expect(lunchLabels.length).toBeGreaterThanOrEqual(6);
  });

  // 【テスト】工数MENUへ戻るナビゲーションリンクが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「工数MENU」というリンク文字がある
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、見出しの表示で読み込み完了を待つ
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    // 検証: 「工数MENU」リンクがある
    expect(screen.getByText("工数MENU")).toBeInTheDocument();
  });

  // 【テスト】画面の説明文が表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「毎日の休憩時間が変更されます」を含む説明文がある
  it("displays description text", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    // 検証: 説明文は改行（<br />）を挟んで2文あるため、正規表現で前半部分を部分一致検索する
    expect(screen.getByText(/毎日の休憩時間が変更されます/)).toBeInTheDocument();
  });

  // 【テスト】「登録」ボタンが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 名前が「登録」のボタンがある
  it("displays submit button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    // 検証: role="button" かつ表示名「登録」の要素がある
    expect(screen.getByRole("button", { name: "登録" })).toBeInTheDocument();
  });

  // 【テスト】「登録」ボタンで休憩時間がPOST送信されること
  //   前提: 取得した休憩時間はすべて上限内（昼休憩60分以内・残業休憩15分以内）、POSTは成功を返す
  //   操作: 画面表示後に「登録」をクリック
  //   期待: api.post が "/api/break_time/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits form via POST", async () => {
    // 準備: POST は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    // 操作: 「登録」ボタンをクリック（フォーム送信）
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    // 検証: POST /api/break_time/ が呼ばれる（送信内容の中身までは確認しない）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/break_time/", expect.any(Object));
    });
  });

  // 【テスト】401以外の通信エラーではサーバーからのメッセージが表示されること
  //   前提: APIは1回目の呼び出しで status 500・message "サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「サーバーエラー」というエラーメッセージが表示される
  it("displays error for non-401 API error", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: レスポンスの message がそのまま画面に表示される
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】通信エラー以外の例外では固定の「不明なエラー」メッセージが表示されること
  //   前提: APIは response を持たない普通の Error を投げる（isAxiosError が false になる）
  //   操作: 画面を表示する
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays error for non-axios error", async () => {
    // 準備: 1回目のAPI呼び出しで通常の Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    // 操作: 画面を表示
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: 不明なエラー用の固定メッセージが表示される
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】人員データが空でも画面が壊れずに表示されること
  //   前提: APIは member_data が空オブジェクトのデータを返す（休憩時間がすべて未設定）
  //   操作: 画面を表示する
  //   期待: 見出し「休憩時間変更」が表示される（エラーで落ちない）
  it("handles empty member_data", async () => {
    // 準備: 1回目のAPI呼び出しで空の人員データを返す
    mockedApi.get.mockResolvedValueOnce({ data: { member_data: {} } });
    // 操作: 画面を表示
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    // 検証: 見出しが表示される
    expect(await screen.findByText("休憩時間変更")).toBeInTheDocument();
  });

  // 【テスト】時刻入力欄が全項目ぶん表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 時刻入力欄が48個以上ある（6種類の直 × 4種類の休憩 × 開始/終了の2つ = 48）
  it("renders time pickers", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><BreakTime /></MemoryRouter>);
    await screen.findByText("休憩時間変更");
    // 検証: モックの時刻入力（data-testid="time-picker"）の数を数える
    const timePickers = screen.getAllByTestId("time-picker");
    expect(timePickers.length).toBeGreaterThanOrEqual(48);
  });
});
