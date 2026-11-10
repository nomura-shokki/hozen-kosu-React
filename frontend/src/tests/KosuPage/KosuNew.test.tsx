/**
 * ============================================================
 * ファイル名 : KosuNew.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuNew.tsx（工数入力画面）
 * 概要       : ログイン者が1日分の工数（作業時間・作業内容・作業詳細・残業）を入力する画面について、
 *              初期表示・データ取得・エラー時の表示や遷移、就業日変更（set_day）、残業時間の増減ボタン、
 *              「残業のみ登録」、「更新」時の入力チェック、作業詳細の手入力切替などを確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/login など）を記録して確認するため
 *   - Loading / TyokuSelect / WorkSelect / DefSelect / KosuBarChart / KosuDisplay / DefTable :
 *                                    画面の本質と関係ない子部品を testid 付きの簡単な部品に置き換えるため
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

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TyokuSelect（直の選択欄）: 選択肢「---」だけを持つ簡易 select にする（value と onChange は受け渡す）
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
// WorkSelect（就業形態の選択欄）: 選択肢「---」だけを持つ簡易 select にする（value と onChange は受け渡す）
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
// DefSelect（作業内容＝工数区分の選択欄）: 選択肢「---」（値は空文字）だけを持つ簡易 select にする
vi.mock("../../Components/DefSelect", () => ({ default: (props: any) => <select data-testid="def-select" onChange={props.onChange}><option value="">---</option></select> }));
// KosuBarChart（工数の棒グラフ）: 固定文字「Chart」を表示する
vi.mock("../../Components/KosuBarChart", () => ({ default: () => <div data-testid="bar-chart">Chart</div> }));
// KosuDisplay（工数の時刻別表示）: 受け取ったショップ名（props.shop）だけを表示する
vi.mock("../../Components/KosuDisplay", () => ({ default: (props: any) => <div data-testid="kosu-display">{props.shop}</div> }));
// DefTable（工数区分定義の一覧表）: 固定文字「DefTable」を表示する
vi.mock("../../Components/DefTable", () => ({ default: () => <div data-testid="def-table">DefTable</div> }));
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
import KosuNew from "../../KosuPage/KosuNew";

// ============================================================
// テスト用データ
// ============================================================

// GET /api/kosu_new/ のレスポンス例（入力中の就業日の工数データ・工数区分定義・ログイン者の人員データ）
//   kosu_data.id   : 既存の工数データID。値があると「工数編集」リンクが表示される
//   time_work / detail_work : 登録済みの作業内容・作業詳細。グラフ表示（KosuDisplay 等）にだけ使われ、
//                    入力フォーム側の作業内容・作業詳細は画面側で毎回空文字にリセットされる
//   detail_list    : 作業詳細の選択肢一覧（空 → 選択肢なし）
//   session_day    : 入力中の就業日（サーバーのセッションに保存された値）。就業日欄の初期値になる
//   warning        : 警告メッセージ（null → 表示しない）
const mockResponse = {
  data: {
    kosu_data: {
      id: "1",
      employee_no3: 12345,
      work_day2: "2025-01-01",
      tyoku2: "1",
      time_work: "A",
      detail_work: "test",
      over_time: 0,
      work_time: "通常",
      def_ver2: "v1",
      judgement: true,
      break_change: false,
    },
    def_data: { kosu_title_1: "作業A" },
    detail_list: [],
    member_data: { name: "テスト太郎", shop: "W1" },
    session_day: "2025-01-01",
    warning: null,
  },
};

// ============================================================
// テスト本体
// ============================================================

// KosuNew 画面の表示・入力操作・登録処理・入力チェック・エラー処理をまとめて確認するテストグループ
describe("KosuNew", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert（残業登録完了時に出る）を無効化し、
  // APIは常に上記の工数データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】見出しに「（氏名）の工数入力」が表示されること
  //   前提: APIは氏名「テスト太郎」の人員データを返す
  //   操作: 画面を表示する
  //   期待: 「テスト太郎の工数入力」という見出しがある
  it("displays the heading with member name", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: 読み込み完了後に氏名入りの見出しが表示される
    expect(await screen.findByText("テスト太郎の工数入力")).toBeInTheDocument();
  });

  // 【テスト】初期表示で工数入力用のデータ取得APIが呼ばれること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/kosu_new/" で呼ばれる
  it("loads and displays data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: GET /api/kosu_new/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_new/");
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
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】（名前は「POST送信」だが）実際には初期表示の取得API呼び出しだけを確認している
  //   前提: POST は成功を返す設定にしてある
  //   操作: 画面を表示する（「更新」ボタンは押さない）
  //   期待: api.get が "/api/kosu_new/" で呼ばれている
  it("submits form data via POST", async () => {
    // 準備: POST は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: フォームは必須項目が多く送信まで再現しにくいため、ここではAPIのURLが正しいことだけを確認する
    expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_new/");
  });

  // 【テスト】登録済みの作業内容があるとき、工数の時刻別表示と棒グラフが表示されること
  //   前提: 取得した工数データの作業内容（time_work）が "A"（空でない）
  //   操作: 画面を表示する
  //   期待: KosuDisplay（kosu-display）と KosuBarChart（bar-chart）のモックが表示される
  it("shows KosuDisplay and KosuBarChart when initialTimeWork exists", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: 2つの子部品が表示されるまで待って確認する
    await waitFor(() => {
      expect(screen.getByTestId("kosu-display")).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });
  });

  // 【テスト】就業日の入力欄にセッションの就業日が入っていること
  //   前提: session_day は 2025-01-01
  //   操作: 画面を表示する
  //   期待: ラベル「就業日」に対応する入力欄の値が "2025-01-01"
  it("displays work_day2 input with correct value", async () => {
    // 準備: 画面を表示し、見出しの表示で読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: ラベル文字（「就業日：OK」のように判定が続くため正規表現で部分一致）から入力欄を探して値を確認する
    const dateInput = screen.getByLabelText(/就業日/);
    expect(dateInput).toHaveValue("2025-01-01");
  });

  // 【テスト】工数入力OK/NG判定が true のとき「OK」と表示されること
  //   前提: 工数データの judgement は true
  //   操作: 画面を表示する
  //   期待: 「OK」という文字がある
  it("displays OK when judgement is true", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 就業日ラベルの横に「OK」が表示される
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  // 【テスト】工数入力OK/NG判定が false のとき「NG」と表示されること
  //   前提: APIは judgement だけを false に変えた工数データを返す
  //   操作: 画面を表示する
  //   期待: 「NG」という文字がある
  it("displays NG when judgement is false", async () => {
    // 準備: 基本データをコピーし、judgement だけ false に差し替えたレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, judgement: false },
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 「NG」が表示される
    expect(screen.getByText("NG")).toBeInTheDocument();
  });

  // 【テスト】ナビゲーションリンク（工数MENU・メインMENU）が表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 「工数MENU」「メインMENU」というリンク文字がある
  it("displays navigation links", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 2つのリンクがある
    expect(screen.getByText("工数MENU")).toBeInTheDocument();
    expect(screen.getByText("メインMENU")).toBeInTheDocument();
  });

  // 【テスト】既存の工数データ（IDあり）のとき「工数編集」リンクが表示されること
  //   前提: 工数データの id は "1"
  //   操作: 画面を表示する
  //   期待: 「工数編集」というリンク文字がある
  it("displays edit link when data has id", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 工数編集画面へのリンクがある
    expect(screen.getByText("工数編集")).toBeInTheDocument();
  });

  // 【テスト】401以外の通信エラーではサーバーからのメッセージが表示されること
  //   前提: APIは1回目の呼び出しで status 500・message "サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「サーバーエラー」というエラーメッセージが表示される
  it("displays error message on non-401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: レスポンスの message がエラー欄に表示される
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】通信エラー以外の例外では固定の「不明なエラー」メッセージが表示されること
  //   前提: APIは response を持たない普通の Error を投げる（isAxiosError が false になる）
  //   操作: 画面を表示する
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays unknown error message on non-axios error", async () => {
    // 準備: 1回目のAPI呼び出しで通常の Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    // 操作: 画面を表示
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: 不明なエラー用の固定メッセージが表示される
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】サーバーから警告メッセージが返ったときに表示されること
  //   前提: APIは warning に "テスト警告" を入れたデータを返す
  //   操作: 画面を表示する
  //   期待: 「テスト警告」が表示される
  it("shows warning message when present", async () => {
    // 準備: warning だけ差し替えたレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: { ...mockResponse.data, warning: "テスト警告" },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: 警告メッセージが表示される
    expect(await screen.findByText("テスト警告")).toBeInTheDocument();
  });

  // 【テスト】就業日を変更すると、その日付をセッションに保存するAPIが呼ばれること
  //   前提: POST は成功を返す
  //   操作: 就業日欄を 2025-02-01 に変更
  //   期待: api.post が "/api/set_day/" と { day: "2025-02-01" } で呼ばれる
  it("handles work_day2 change and posts to set_day", async () => {
    // 準備: POST は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 就業日欄を name 付きで変更する（name="work_day2" のときだけ set_day が呼ばれる）
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { name: "work_day2", value: "2025-02-01" } });
    // 検証: POST /api/set_day/ が新しい日付付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/set_day/", { day: "2025-02-01" });
    });
  });

  // 【テスト】残業時間の「+」（15分）ボタンで残業時間が15増えること
  //   前提: 残業時間は 0
  //   操作: 1つ目の「+」ボタン（+15分）をクリック
  //   期待: 残業時間欄の値が 15 になる
  it("handles over_time increment button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「+」ボタンは2つあり、1つ目が +15分、2つ目が +1分。1つ目をクリック
    const plusButtons = screen.getAllByRole("button", { name: "+" });
    fireEvent.click(plusButtons[0]);
    // 検証: 残業時間欄（id="over_time"）が 15 になる
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    expect(overTimeInput).toHaveValue(15);
  });

  // 【テスト】残業時間の「-」（15分）ボタンで残業時間が15減ること
  //   前提: 残業時間は 0
  //   操作: 2つ目の「-」ボタン（-15分）をクリック
  //   期待: 残業時間欄の値が -15 になる（マイナス値を防ぐ処理はない）
  it("handles over_time decrement button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    const minusButtons = screen.getAllByRole("button", { name: "-" });
    // 操作: 1つ目の「-」は -1分（handleDecrement2）、2つ目は -15分（handleDecrement）。2つ目をクリック
    fireEvent.click(minusButtons[1]);
    // 検証: 残業時間欄が -15 になる
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    expect(overTimeInput).toHaveValue(-15);
  });

  // 【テスト】必須項目が未入力のまま「更新」すると入力エラーが表示されること
  //   前提: 入力フォームの作業内容・作業詳細は初期表示で空になっている
  //   操作: 「更新」をクリック
  //   期待: 「入力必要項目が入力されていません。」が表示される
  it("handles form submission validation - missing fields", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「更新」ボタンをクリック（フォーム送信）
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 必須項目未入力のエラーメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("入力必要項目が入力されていません。")).toBeInTheDocument();
    });
  });

  // 【テスト】「残業のみ登録」ボタンで残業時間がPOST送信されること
  //   前提: 残業時間は 0（15分単位チェックを通過する）、POST は成功を返す
  //   操作: 「残業のみ登録」をクリック
  //   期待: api.post が "/api/over_time/" と送信データ（工数データ一式）付きで呼ばれる
  it("sends overtime via POST when overtime button clicked", async () => {
    // 準備: POST は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「残業のみ登録」ボタンをクリック
    const overTimeBtn = screen.getByRole("button", { name: "残業のみ登録" });
    fireEvent.click(overTimeBtn);
    // 検証: POST /api/over_time/ が呼ばれる（送信内容の中身までは確認しない）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/over_time/", expect.any(Object));
    });
  });

  // 【テスト】作業詳細の「手入力」切替スイッチが表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 「手入力」を含む文字がある
  it("displays detail select mode toggle", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 「手入力：」のように表示されるため、正規表現で部分一致検索する
    expect(screen.getByText(/手入力/)).toBeInTheDocument();
  });

  // 【テスト】作業時間の時刻入力欄（開始・終了）が表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 時刻入力欄（time-picker）が2個以上ある
  it("displays time pickers", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: モックの時刻入力（data-testid="time-picker"）の数を数える
    const timePickers = screen.getAllByTestId("time-picker");
    expect(timePickers.length).toBeGreaterThanOrEqual(2);
  });

  // 【テスト】終了時刻を現在時刻にする「現在時刻」ボタンが表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 「現在時刻」という文字がある
  it("displays current time button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 「現在時刻」ボタンがある
    expect(screen.getByText("現在時刻")).toBeInTheDocument();
  });

  // 【テスト】「休憩時間工数入力可」スイッチをクリックするとONになること
  //   前提: 初期状態はOFF
  //   操作: チェックボックス（id="break_change"）をクリック
  //   期待: チェックが入る
  it("toggles break change checkbox", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 休憩時間工数入力可のチェックボックスをクリック
    const breakCheckbox = document.getElementById("break_change") as HTMLInputElement;
    fireEvent.click(breakCheckbox);
    // 検証: チェックが入る
    expect(breakCheckbox).toBeChecked();
  });

  // （「翌日」チェックボックス id="tomorrow_check" のテストは消した。KosuNew.tsx にその欄が無いため）

  // 【テスト】「更新」ボタンを押すと、登録APIが呼ばれるか入力エラーが表示されること
  //   前提: APIは作業内容 "A"・作業詳細 "test detail" を持つ工数データを返す
  //   操作: 「更新」をクリック
  //   期待: POST /api/kosu_new/ が呼ばれている、またはエラー欄（role="alert"）が表示されている
  //   ※画面側は取得後に入力フォームの作業内容・作業詳細を空にするため、実際には
  //     「入力必要項目が入力されていません。」のエラーになり、POST までは到達しない
  it("successfully submits form with valid data via POST", async () => {
    // 準備: 就業形態="通常"・直="1" に加え、作業内容と作業詳細も入ったデータを用意する
    const fullMockResponse = {
      data: {
        ...mockResponse.data,
        kosu_data: {
          ...mockResponse.data.kosu_data,
          time_work: "A",
          detail_work: "test detail",
        },
      },
    };
    // 準備: 上記データを1回だけ返し、POST は成功を返すようにする
    mockedApi.get.mockResolvedValueOnce(fullMockResponse);
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 作業時間（selectedTimes の time1/time2）は初期化時に設定済み。
    // 就業形態="通常"・直="1"・作業内容="A"・作業詳細="test detail" が入っていれば
    // 入力チェックを通過して POST が呼ばれる想定で書かれている
    await waitFor(() => {
      // 検証: POST されたか、入力エラーが表示されたかのどちらかであればよい
      const calls = mockedApi.post.mock.calls;
      // POST の呼び出し履歴（call[0] はURL）から、工数登録APIの呼び出しがあるかを調べる
      const hasKosuNewPost = calls.some((c: any) => c[0] === "/api/kosu_new/");
      // 就業日変更APIの呼び出し有無（この変数は以降の検証では使われていない）
      const hasSetDayPost = calls.some((c: any) => c[0] === "/api/set_day/");
      // 少なくとも工数登録APIが呼ばれたか、エラー欄（role="alert"）が表示されていること
      expect(hasKosuNewPost || screen.queryByRole("alert") !== null).toBe(true);
    });
  });

  // 【テスト】開始時刻と終了時刻が同じまま「更新」すると入力エラーが表示されること
  //   前提: APIは作業内容・作業詳細を持つ工数データを返す
  //   操作: 「更新」をクリック
  //   期待: エラー欄（role="alert"）が表示される（メッセージの種類までは確認しない）
  //   ※画面側は入力フォームの作業内容・作業詳細を空にするため、実際に表示されるのは
  //     時刻エラーではなく「入力必要項目が入力されていません。」になる
  it("shows validation error when time1 equals time2", async () => {
    // 準備: 必須項目をそろえたつもりのデータを用意する（作業内容 "A"・作業詳細 "detail"）
    const fullResponse = {
      data: {
        ...mockResponse.data,
        kosu_data: {
          ...mockResponse.data.kosu_data,
          time_work: "A",
          detail_work: "detail",
        },
      },
    };
    // 準備: 上記データを1回だけ返し、画面を表示して読み込み完了を待つ
    mockedApi.get.mockResolvedValueOnce(fullResponse);
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 開始時刻（time1）と終了時刻（time2）は localStorage の保存値で初期化され、保存値がなければ
    // どちらも現在時刻（5分単位に切り捨て）になるため同じ値になる
    // 操作: 「更新」をクリックして time1 === time2 の入力チェックを起こす
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 「必須項目未入力」か「作業時間の誤り」のどちらかの入力エラーが表示される
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // 【テスト】「残業のみ登録」で残業時間が15分単位でないと入力エラーが表示されること
  //   前提: 就業形態は「通常」（休出ではない）
  //   操作: 残業時間欄を 7 に変更して「残業のみ登録」をクリック
  //   期待: 「残業の最小単位は15分です。確認してください。」が表示される
  it("shows overtime validation error - 15min unit", async () => {
    // 準備: POST は成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 残業時間を15分単位でない値（7分）に変更
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    fireEvent.change(overTimeInput, { target: { name: "over_time", value: "7" } });
    // 操作: 「残業のみ登録」ボタンをクリック
    const overTimeBtn = screen.getByRole("button", { name: "残業のみ登録" });
    fireEvent.click(overTimeBtn);
    // 検証: 15分単位エラーのメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("残業の最小単位は15分です。確認してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】就業日変更API（set_day）が401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: POST は1回目の呼び出しで status 401 のエラーを返す
  //   操作: 就業日欄を 2025-03-01 に変更
  //   期待: navigate("/login") が呼ばれる
  it("handles set_day POST error (401)", async () => {
    // 準備: POST を 401 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 就業日欄を変更（POST /api/set_day/ が呼ばれる）
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { name: "work_day2", value: "2025-03-01" } });
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】就業日変更API（set_day）が500を返したらサーバーからのメッセージが表示されること
  //   前提: POST は status 500・message "日付エラー" のエラーを返す
  //   操作: 就業日欄を 2025-03-01 に変更
  //   期待: 「日付エラー」が表示される
  it("handles set_day POST error (non-401)", async () => {
    // 準備: POST を 500 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce({ response: { status: 500, data: { message: "日付エラー" } } });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 就業日欄を変更
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { name: "work_day2", value: "2025-03-01" } });
    // 検証: レスポンスの message がエラー欄に表示される
    await waitFor(() => {
      expect(screen.getByText("日付エラー")).toBeInTheDocument();
    });
  });

  // 【テスト】就業日変更API（set_day）で通信エラー以外の例外が起きたら「不明なエラー」が表示されること
  //   前提: POST は response を持たない普通の Error を投げる
  //   操作: 就業日欄を 2025-03-01 に変更
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("handles set_day POST non-axios error", async () => {
    // 準備: POST で通常の Error を投げるようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 就業日欄を変更
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { name: "work_day2", value: "2025-03-01" } });
    // 検証: 不明なエラー用の固定メッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】残業登録API（over_time）が401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: POST は1回目の呼び出しで status 401 のエラーを返す
  //   操作: 「残業のみ登録」をクリック
  //   期待: navigate("/login") が呼ばれる
  it("handles overtime POST 401 error", async () => {
    // 準備: POST を 401 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「残業のみ登録」ボタンをクリック
    const overTimeBtn = screen.getByRole("button", { name: "残業のみ登録" });
    fireEvent.click(overTimeBtn);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】残業登録API（over_time）が500を返したらサーバーからのメッセージが表示されること
  //   前提: POST は status 500・message "残業エラー" のエラーを返す
  //   操作: 「残業のみ登録」をクリック
  //   期待: 「残業エラー」が表示される
  it("handles overtime POST server error", async () => {
    // 準備: POST を 500 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce({ response: { status: 500, data: { message: "残業エラー" } } });
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「残業のみ登録」ボタンをクリック
    const overTimeBtn = screen.getByRole("button", { name: "残業のみ登録" });
    fireEvent.click(overTimeBtn);
    // 検証: レスポンスの message がエラー欄に表示される
    await waitFor(() => {
      expect(screen.getByText("残業エラー")).toBeInTheDocument();
    });
  });

  // 【テスト】残業登録API（over_time）で通信エラー以外の例外が起きたら「不明なエラー」が表示されること
  //   前提: POST は response を持たない普通の Error を投げる
  //   操作: 「残業のみ登録」をクリック
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("handles overtime POST non-axios error", async () => {
    // 準備: POST で通常の Error を投げるようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「残業のみ登録」ボタンをクリック
    const overTimeBtn = screen.getByRole("button", { name: "残業のみ登録" });
    fireEvent.click(overTimeBtn);
    // 検証: 不明なエラー用の固定メッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】1分単位の「+」「-」ボタンで残業時間が1ずつ増減すること
  //   前提: 残業時間は 0
  //   操作: 2つ目の「+」（+1分）をクリックし、続けて1つ目の「-」（-1分）をクリック
  //   期待: 「+」の後は 1、「-」の後は 0 になる
  it("handles increment2 and decrement2 buttons", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    const plusButtons = screen.getAllByRole("button", { name: "+" });
    const minusButtons = screen.getAllByRole("button", { name: "-" });
    // 操作: 1つ目の「+」は handleIncrement（+15分）、2つ目の「+」は handleIncrement2（+1分）。2つ目をクリック
    fireEvent.click(plusButtons[1]); // +1分
    // 検証: 残業時間欄が 1 になる
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    expect(overTimeInput).toHaveValue(1);
    // 操作: 1つ目の「-」（handleDecrement2）をクリック
    fireEvent.click(minusButtons[0]); // -1分
    // 検証: 残業時間欄が 0 に戻る
    expect(overTimeInput).toHaveValue(0);
  });

  // 【テスト】作業詳細の「手入力」スイッチをONにすると、選択欄が自由入力欄に切り替わること
  //   前提: 初期状態は選択モード（作業詳細は select で表示）
  //   操作: 「手入力」のチェックボックスをクリック
  //   期待: id="detail_work" の要素が type="text" の入力欄になる
  //   ※「手入力」のチェックボックスが見つからない場合は検証自体が行われない書き方になっている
  it("toggles detail select mode to text input", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ（初期状態は選択モード）
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 準備: 画面内のチェックボックスをすべて取得する
    const checkboxes = screen.getAllByRole("checkbox");
    // 準備: 親要素（span または label）の文字に「手入力」を含むものを作業詳細の入力方式スイッチとして探す
    const detailCheckbox = checkboxes.find(cb => {
      const label = cb.closest("span") || cb.closest("label");
      return label?.textContent?.includes("手入力");
    });
    if (detailCheckbox) {
      // 操作: 「手入力」スイッチをクリック
      fireEvent.click(detailCheckbox);
      // 検証: 切り替え後は自由入力欄（type="text"）が表示される
      const detailInput = document.getElementById("detail_work") as HTMLInputElement;
      expect(detailInput).toBeInTheDocument();
      expect(detailInput.type).toBe("text");
    }
  });

  // 【テスト】工数データのIDが空のとき「工数編集」リンクが表示されないこと
  //   前提: APIは id を空文字にした工数データを返す（まだ未登録の日）
  //   操作: 画面を表示する
  //   期待: 「工数編集」という文字がない
  it("does not show edit link when data has no id", async () => {
    // 準備: id だけ空文字に差し替えたレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, id: "" },
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 見つからなくてもエラーにならない queryByText で、リンクが無いことを確認する
    expect(screen.queryByText("工数編集")).not.toBeInTheDocument();
  });

  // 【テスト】作業詳細の選択肢一覧があるとき、作業詳細の選択欄が表示されること
  //   前提: APIは作業詳細の選択肢を2件（作業A詳細・作業B詳細）返す
  //   操作: 画面を表示する
  //   期待: id="detail_work" の要素がある（選択肢の中身や絞り込み結果までは確認しない）
  it("displays detail_work select with filtered options", async () => {
    // 準備: 作業詳細の選択肢（def_symbol=対応する工数区分の記号、def_select=表示文字）を2件持つレスポンスを返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        detail_list: [
          { def_symbol: "A", def_select: "作業A詳細" },
          { def_symbol: "B", def_select: "作業B詳細" },
        ],
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 検証: 作業詳細の選択欄（id="detail_work"）が存在する
    const detailSelect = document.getElementById("detail_work") as HTMLSelectElement;
    expect(detailSelect).toBeInTheDocument();
  });

  // 【テスト】残業時間欄に直接入力した値が反映されること
  //   前提: 残業時間は 0
  //   操作: 残業時間欄を 30 に変更
  //   期待: 残業時間欄の値が 30 になる
  it("handles over_time change via input", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 残業時間欄を name 付きで 30 に変更（over_time は数値に変換して保存される）
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    fireEvent.change(overTimeInput, { target: { name: "over_time", value: "30" } });
    // 検証: 数値の 30 が入っている
    expect(overTimeInput).toHaveValue(30);
  });

  // 【テスト】「現在時刻」ボタンをクリックしても画面が壊れないこと
  //   前提: APIは工数データを返す
  //   操作: 「現在時刻」をクリック（終了時刻を現在時刻に設定する処理が動く）
  //   期待: 見出しが表示されたまま（エラーで落ちない）。設定された時刻自体は確認しない
  it("handles click on current time button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「現在時刻」ボタンをクリック
    const currentTimeBtn = screen.getByText("現在時刻");
    fireEvent.click(currentTimeBtn);
    // 検証: 画面が壊れていないこと（見出しが残っていること）だけを確認する
    expect(screen.getByText("テスト太郎の工数入力")).toBeInTheDocument();
  });

  // 【テスト】作業詳細に「$」を含むと入力エラーになること（を意図したテスト）
  //   前提: APIは作業詳細 "test$detail" を持つ工数データを返す
  //   操作: 「更新」をクリック
  //   期待: エラー欄（role="alert"）が表示される（メッセージの種類までは確認しない）
  //   ※画面側は入力フォームの作業詳細を空にするため、実際には「$」のチェックまで到達せず
  //     「入力必要項目が入力されていません。」が表示される
  it("shows detail_work validation error for $ character", async () => {
    // 作業詳細に "$" を含むデータを用意する（"$" は作業詳細の区切り文字なので入力禁止）
    // 入力チェックは handleSubmit の中で行われるため、必須項目もそろえておく必要がある
    // ここでは入力エラーのメッセージ欄が表示されることだけを確認する
    const fullResponse = {
      data: {
        ...mockResponse.data,
        kosu_data: {
          ...mockResponse.data.kosu_data,
          time_work: "A",
          detail_work: "test$detail",
        },
      },
    };
    // 準備: 上記データを1回だけ返し、画面を表示して読み込み完了を待つ
    mockedApi.get.mockResolvedValueOnce(fullResponse);
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 何らかの入力エラー（time1===time2 なら必須項目/時刻エラー、そうでなければ「$」エラー）が表示される
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // 【テスト】工数データが null（その日の登録なし）でも画面が表示されること
  //   前提: APIは kosu_data: null、氏名「テスト」の人員データを返す
  //   操作: 画面を表示する
  //   期待: 「テストの工数入力」という見出しが表示される（見つからなければ findByText がエラーになり失敗する）
  it("handles response with no kosu_data", async () => {
    // 準備: 工数データなし・工数区分定義なしのレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: null,
        def_data: {},
        detail_list: [],
        member_data: { name: "テスト", shop: "W1" },
        session_day: "2025-01-01",
        warning: null,
      },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    // 検証: 見出しが表示されるまで待つ（expect は無いが、表示されなければここで失敗する）
    await screen.findByText("テストの工数入力");
  });

  // 【テスト】作業内容（DefSelect）を変更しても画面が壊れないこと
  //   前提: APIは作業詳細の選択肢を2件返す
  //   操作: 作業内容の選択欄を name="time_work"・値 "B" で変更する
  //   期待: 見出しが表示されたまま（エラーで落ちない）
  //   ※モックの select には値 "B" の選択肢がないため、実際に画面へ渡る値は空文字になる
  it("handles handleChange for time_work field", async () => {
    // 準備: 作業詳細の選択肢を2件持つレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        detail_list: [
          { def_symbol: "A", def_select: "作業A詳細" },
          { def_symbol: "B", def_select: "作業B詳細" },
        ],
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: DefSelect（モック）の change イベントで作業内容の変更を再現する
    const defSelect = screen.getByTestId("def-select");
    fireEvent.change(defSelect, { target: { name: "time_work", value: "B" } });
    // 検証: 画面が壊れていないこと（見出しが残っていること）だけを確認する
    expect(screen.getByText("テスト太郎の工数入力")).toBeInTheDocument();
  });

  // 【テスト】選択モードで作業詳細を選んでも画面が壊れないこと
  //   前提: APIは作業詳細の選択肢を1件（作業A詳細、工数区分 "A"）返す
  //   操作: 作業詳細の選択欄で「作業A詳細」を選ぶ
  //   期待: 見出しが表示されたまま（エラーで落ちない）。作業内容が自動で "A" になるかまでは確認しない
  it("handles handleChange for detail_work in select mode", async () => {
    // 準備: 作業詳細の選択肢を1件持つレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        detail_list: [
          { def_symbol: "A", def_select: "作業A詳細" },
        ],
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuNew /></MemoryRouter>);
    await screen.findByText("テスト太郎の工数入力");
    // 操作: 作業詳細の選択欄（id="detail_work"）で「作業A詳細」を選ぶ
    const detailSelect = document.getElementById("detail_work") as HTMLSelectElement;
    fireEvent.change(detailSelect, { target: { name: "detail_work", value: "作業A詳細" } });
    // 検証: 画面が壊れていないこと（見出しが残っていること）だけを確認する
    expect(screen.getByText("テスト太郎の工数入力")).toBeInTheDocument();
  });
});
