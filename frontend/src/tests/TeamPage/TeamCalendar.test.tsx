/**
 * ============================================================
 * ファイル名 : TeamCalendar.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : TeamPage/TeamCalendar.tsx（班員工数入力状況画面）
 * 概要       : 表示週のデータ取得・見出し/リンク/日付欄/各ボタン/曜日見出し/班員行の表示・
 *              「検索」「前週」「次週」での POST 送信・日付入力の反映・ウィンドウサイズ変更・
 *              エラー時（401/403/500）の挙動・工数データ（就業形態）の表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import TeamCalendar from "../../TeamPage/TeamCalendar";

// ============================================================
// テストデータ
// ============================================================

// GET /api/team_calendar/ のレスポンス例（工数データなし・班員1人）
const mockResponse = {
  data: {
    kosu_data: [], // 表示週の班員の工数データ（ここでは0件）
    Search_day: "2025-01-15", // セッションに保存された表示日（この日を含む日曜〜土曜の週を表示する）
    member_name_list: [[12345, "テスト太郎"]], // 班員の [従業員番号, 氏名] の一覧
  },
};

// ============================================================
// テスト本体
// ============================================================

// TeamCalendar 画面の表示・週の切り替え・エラー処理をまとめて確認するテストグループ
describe("TeamCalendar", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは班員1人・工数データ0件を返す
  //   操作: 画面を表示する
  //   期待: 見出し「班員工数入力状況」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("班員工数入力状況")).toBeInTheDocument();
  });

  // 【テスト】表示時に表示週の班員工数データを取得すること
  //   前提: APIは班員1人・工数データ0件を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/team_calendar/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    // 検証: データ取得APIがパラメータなしで呼ばれる（表示日はサーバー側のセッションで管理される）
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_calendar/");
    });
  });

  // 【テスト】データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】班員の氏名が表に表示されること
  //   前提: 班員一覧に「テスト太郎」がいる
  //   操作: 画面を表示する
  //   期待: 「テスト太郎」が表示される
  it("displays member names", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    // 検証: 表の左端（氏名のセル）に班員名が表示される
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
  });

  // 【テスト】班員メニューへ戻るリンクが表示されること
  //   前提: APIは班員データを返す
  //   操作: 画面を表示する
  //   期待: 「班員MENU」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 検証: ナビゲーション欄に班員メニュー画面へのリンクがある
    expect(screen.getByText("班員MENU")).toBeInTheDocument();
  });

  // 【テスト】表示日を選ぶ日付入力欄が表示されること
  //   前提: APIは班員データを返す
  //   操作: 画面を表示する
  //   期待: ラベル「日付選択:」に紐づく入力欄が存在する
  it("displays date input", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 検証: label の htmlFor で紐づいた日付入力欄がラベル文字から見つかる
    expect(screen.getByLabelText("日付選択:")).toBeInTheDocument();
  });

  // 【テスト】「検索」ボタンが表示されること
  //   前提: APIは班員データを返す
  //   操作: 画面を表示する
  //   期待: 名前が「検索」のボタンが存在する
  it("displays search button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 検証: 「検索」ボタンがある
    expect(screen.getByRole("button", { name: "検索" })).toBeInTheDocument();
  });

  // 【テスト】1週間ずつ移動する「前週」「次週」ボタンが表示されること
  //   前提: APIは班員データを返す
  //   操作: 画面を表示する
  //   期待: 名前が「前週」「次週」のボタンが存在する
  it("displays week navigation buttons", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 検証: 「前週」「次週」ボタンがある
    expect(screen.getByRole("button", { name: "前週" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次週" })).toBeInTheDocument();
  });

  // 【テスト】表の見出しに曜日が表示されること
  //   前提: APIは班員データを返す
  //   操作: 画面を表示する
  //   期待: 「日」「月」「土」の見出しが表示される
  it("displays weekday headers", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 検証: 曜日の見出しセルがある（完全一致なので「日付」の見出しは「日」に該当しない）
    expect(screen.getByText("日")).toBeInTheDocument();
    expect(screen.getByText("月")).toBeInTheDocument();
    expect(screen.getByText("土")).toBeInTheDocument();
  });

  // 【テスト】班員ごとに「勤務」「残業(分)」「入力時間」の3行が表示されること
  //   前提: 班員は「テスト太郎」1人
  //   操作: 画面を表示する
  //   期待: 「勤務」「残業(分)」「入力時間」の行見出しが表示される
  it("displays member rows with 勤務, 残業, 入力時間", async () => {
    // 準備: 画面を表示し、班員名の表示を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    // 検証: 班員1人分の3行の見出しがそれぞれある
    expect(screen.getByText("勤務")).toBeInTheDocument();
    expect(screen.getByText("残業(分)")).toBeInTheDocument();
    expect(screen.getByText("入力時間")).toBeInTheDocument();
  });

  // 【テスト】「検索」ボタンで選択中の日付が表示日として POST されること
  //   前提: 表示日を保存するAPIは成功を返す
  //   操作: 「検索」ボタンをクリック
  //   期待: api.post が "/api/team_calendar/" と送信データ（オブジェクト）付きで呼ばれる
  it("handles search button click", async () => {
    // 準備: 表示日保存APIを成功させる（成功後に画面はデータを取得し直す）
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 操作: 「検索」ボタンをクリック
    const searchBtn = screen.getByRole("button", { name: "検索" });
    fireEvent.click(searchBtn);
    // 検証: 選択中の日付（day）を含むオブジェクト付きで POST が呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_calendar/", expect.any(Object));
    });
  });

  // 【テスト】「前週」ボタンで表示日を1週間前へずらすAPIが呼ばれること
  //   前提: 週移動APIは成功を返す
  //   操作: 「前週」ボタンをクリック
  //   期待: api.post が "/api/team_calendar_week_jump/" と { week: "B" }（Before＝前週）で呼ばれる
  it("handles 前週 button click", async () => {
    // 準備: 週移動APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 操作: 「前週」ボタンをクリック
    const prevBtn = screen.getByRole("button", { name: "前週" });
    fireEvent.click(prevBtn);
    // 検証: 前週を表す "B" を送っている
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_calendar_week_jump/", { week: "B" });
    });
  });

  // 【テスト】「次週」ボタンで表示日を1週間後へずらすAPIが呼ばれること
  //   前提: 週移動APIは成功を返す
  //   操作: 「次週」ボタンをクリック
  //   期待: api.post が "/api/team_calendar_week_jump/" と { week: "A" }（After＝次週）で呼ばれる
  it("handles 次週 button click", async () => {
    // 準備: 週移動APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 操作: 「次週」ボタンをクリック
    const nextBtn = screen.getByRole("button", { name: "次週" });
    fireEvent.click(nextBtn);
    // 検証: 次週を表す "A" を送っている
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_calendar_week_jump/", { week: "A" });
    });
  });

  // 【テスト】日付入力欄を変更すると値が反映されること
  //   前提: 日付入力欄の初期値はレスポンスの表示日（2025-01-15）
  //   操作: 日付入力欄に 2025-06-15 を入力
  //   期待: 入力欄の値が "2025-06-15" になる（検索はまだ実行されない）
  it("handles date input change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 操作: 日付入力欄の値を変更する
    const dateInput = screen.getByLabelText("日付選択:");
    fireEvent.change(dateInput, { target: { value: "2025-06-15" } });
    // 検証: state が更新され、入力欄の値が変わる
    expect(dateInput).toHaveValue("2025-06-15");
  });

  // 【テスト】ウィンドウサイズが変わっても画面が壊れないこと
  //   前提: 画面は表の高さ・幅をウィンドウサイズ変更のたびに計算し直す
  //   操作: ウィンドウの resize イベントを発生させる
  //   期待: 見出し「班員工数入力状況」が表示されたままである
  it("handles window resize", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("班員工数入力状況");
    // 操作: resize イベントを発生させる（state 更新を伴うため act で包み、更新の完了を待つ）
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    // 検証: エラーにならず画面が表示されている
    expect(screen.getByText("班員工数入力状況")).toBeInTheDocument();
  });

  // 【テスト】データ取得APIがサーバーエラー（401/403/400 以外）を返したら、そのメッセージを表示すること
  //   前提: APIは status 500・message="サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「Error: サーバーエラー」が表示される
  it("displays error state", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    // 検証: 画面全体がエラー表示（"Error: " + メッセージ）に置き換わる
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】データ取得APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】表示週に工数データがあれば、その日の「勤務」欄に就業形態が表示されること
  //   前提: 2025-01-15 に就業形態「通常」・作業内容あり・入力OKの工数データが1件ある
  //   操作: 画面を表示する
  //   期待: 「通常」が表示される
  it("displays kosu data with time_work", async () => {
    // 準備: 作業内容（1文字＝5分、全288文字＝24時間）を作る
    //   "A"×60 → 0:00〜5:00 / "#"×168（作業なし）→ 5:00〜19:00 / "B"×60 → 19:00〜24:00
    const timeWork = "A".repeat(60) + "#".repeat(168) + "B".repeat(60);
    // 準備: 表示日と同じ日付（2025-01-15）の工数データを1件含むレスポンス
    const dataWithKosu = {
      data: {
        kosu_data: [
          { id: 1, employee_no3: 12345, name: "テスト太郎", work_day2: "2025-01-15", tyoku2: "1", work_time: "通常", time_work: timeWork, judgement: true, over_time: "30" },
        ],
        Search_day: "2025-01-15",
        member_name_list: [[12345, "テスト太郎"]],
      },
    };
    // 準備: 1回目のAPIで上のデータを返す
    mockedApi.get.mockResolvedValueOnce(dataWithKosu);
    // 操作: 画面を表示し、班員名の表示を待つ
    render(<MemoryRouter><TeamCalendar /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    // 検証: 「従業員番号_就業日」で引いた工数データの就業形態が「勤務」行に表示される
    expect(screen.getByText("通常")).toBeInTheDocument();
  });
});
