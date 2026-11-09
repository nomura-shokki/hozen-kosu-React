/**
 * ============================================================
 * ファイル名 : KosuEdit.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuEdit.tsx（工数データ編集画面）
 * 概要       : 既存の工数データ1件を編集する画面について、初期表示・データ取得・エラー時の表示や遷移、
 *              作業時間の行追加/行削除、就業日更新、更新（PUT）時の入力チェック（必須項目・残業時間の単位・
 *              作業時間の未入力・作業詳細の文字数と「$」）、残業時間の送信、行ごとの削除（POST）を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の工数ID（1）の固定のため
 *   - Loading / TyokuSelect / WorkSelect / DefSelect / KosuBarChart / DefTable :
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

// react-router-dom のモック
//   useNavigate: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
//   useParams  : URL の :id（編集対象の工数データID）を "1" に固定する
//   それ以外（Link や MemoryRouter など）は本物をそのまま使う
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TyokuSelect（直の選択欄）: 選択肢「---」だけを持つ簡易 select にする（value と onChange は受け渡す）
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
// WorkSelect（就業形態の選択欄）: 選択肢「---」だけを持つ簡易 select にする（value と onChange は受け渡す）
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
// DefSelect（作業内容＝工数区分の選択欄）: 選択肢「---」だけの簡易 select。作業時間の行数を数えるのにも使う
vi.mock("../../Components/DefSelect", () => ({ default: (props: any) => <select data-testid="def-select" onChange={props.onChange}><option value="">---</option></select> }));
// KosuBarChart（工数の棒グラフ）: 固定文字「Chart」を表示する
vi.mock("../../Components/KosuBarChart", () => ({ default: () => <div data-testid="bar-chart">Chart</div> }));
// DefTable（工数区分定義の一覧表）: 固定文字「DefTable」を表示する
vi.mock("../../Components/DefTable", () => ({ default: () => <div data-testid="def-table">DefTable</div> }));
// MUI の日付・時刻部品のモック
//   LocalizationProvider: 中身をそのまま表示するだけの入れ物にする
//   MobileTimePicker: 数を数えられるよう testid 付きの input を表示する。
//     入力欄を変更（change イベント）すると onChange(null) を呼び、「時刻を消した（未入力にした）」操作を再現する
vi.mock("@mui/x-date-pickers", () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
  MobileTimePicker: (props: any) => <input data-testid="time-picker" onChange={() => props.onChange?.(null)} />,
}));
// AdapterDateFns（日付ライブラリとの橋渡し役）のモック: 中身のない空のクラスにする
vi.mock("@mui/x-date-pickers/AdapterDateFns", () => ({ AdapterDateFns: class {} }));

// テスト対象の画面（モック定義の後に読み込む）
import KosuEdit from "../../KosuPage/KosuEdit";

// ============================================================
// テスト用データ
// ============================================================

// GET /api/kosu_update/1/ のレスポンス例（編集対象の工数データ・工数区分定義・ログイン者の人員データ）
//   time_work  : 5分刻み288枠（24時間×12）すべてが "A"（＝1番目の工数区分「作業A」）
//   detail_work: 288枠ぶんの作業詳細（すべて "test"）を "$" で区切って連結した文字列
//   → 全枠が同じ工数区分・同じ作業詳細のため、画面上の作業時間の行は1行にまとまる
//   over_time  : 残業時間（分）。0 なので15分単位チェックを通過する
//   detail_data_list: 作業詳細の選択肢一覧（空 → 作業詳細は自由入力欄として表示される）
const mockResponse = {
  data: {
    kosu_data: {
      employee_no3: 12345,
      work_day2: "2025-01-01",
      tyoku2: "1",
      time_work: "A".repeat(288),
      detail_work: Array(288).fill("test").join("$"),
      over_time: 0,
      work_time: "通常",
      def_ver2: "v1",
      judgement: true,
      break_change: false,
    },
    def_data: { kosu_title_1: "作業A" },
    member_data: { employee_no: 12345, name: "テスト太郎", shop: "W1" },
    detail_data_list: [],
  },
};

// ============================================================
// テスト本体
// ============================================================

// KosuEdit 画面の表示・行操作・更新処理・入力チェック・エラー処理をまとめて確認するテストグループ
describe("KosuEdit", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert（更新完了時などに出る）を無効化し、
  // APIは常に上記の工数データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面見出し「工数データ編集」が表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 「工数データ編集」という見出しがある
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数データ編集")).toBeInTheDocument();
  });

  // 【テスト】URL の工数IDを使った取得APIが呼ばれること
  //   前提: URL の :id は "1"
  //   操作: 画面を表示する
  //   期待: api.get が "/api/kosu_update/1/" で呼ばれる
  it("loads data from API with correct endpoint", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: GET /api/kosu_update/1/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/kosu_update/1/");
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
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】401以外の通信エラーでは「Error: サーバーからのメッセージ」が表示されること
  //   前提: APIは1回目の呼び出しで status 500・message "サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 画面全体が「Error: サーバーエラー」の表示に置き換わる
  it("displays error message when API returns non-401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 「Error: 」に続けてレスポンスの message が表示される
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】通信エラー以外の例外では「Error: 不明なエラー…」が表示されること
  //   前提: APIは response を持たない普通の Error を投げる（isAxiosError が false になる）
  //   操作: 画面を表示する
  //   期待: 「Error: 不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays unknown error for non-axios errors", async () => {
    // 準備: 1回目のAPI呼び出しで通常の Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("network failure"));
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 不明なエラー用の固定メッセージが表示される
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】就業日の入力欄に取得した就業日が入っていること
  //   前提: 工数データの就業日は 2025-01-01
  //   操作: 画面を表示する
  //   期待: ラベル「就業日」に対応する入力欄の値が "2025-01-01"
  it("displays work_day2 input with value", async () => {
    // 準備: 画面を表示し、見出しの表示で読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 検証: ラベル文字（「就業日:OK」のように判定が続くため正規表現で部分一致）から入力欄を探して値を確認する
    const dateInput = screen.getByLabelText(/就業日/);
    expect(dateInput).toHaveValue("2025-01-01");
  });

  // 【テスト】工数入力OK/NG判定が true のとき「OK」と表示されること
  //   前提: 工数データの judgement は true
  //   操作: 画面を表示する
  //   期待: 「OK」という文字がある
  it("displays OK when judgement is true", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
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
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 検証: 「NG」が表示される
    expect(screen.getByText("NG")).toBeInTheDocument();
  });

  // 【テスト】ナビゲーションリンク（工数履歴・工数入力）が表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 「工数履歴」「工数入力」というリンク文字がある
  it("displays navigation links", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 検証: 2つのリンクがある
    expect(screen.getByText("工数履歴")).toBeInTheDocument();
    expect(screen.getByText("工数入力")).toBeInTheDocument();
  });

  // 【テスト】作業時間の「行追加」「行削除」ボタンが表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 名前が「行追加」「行削除」のボタンがある
  it("displays 行追加 and 行削除 buttons", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 検証: 2つのボタンがある
    expect(screen.getByRole("button", { name: "行追加" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "行削除" })).toBeInTheDocument();
  });

  // 【テスト】「行追加」ボタンで作業時間の行が1行増えること
  //   前提: 取得した工数データから作業時間の行が1行作られている
  //   操作: 行が表示されるのを待ち、「行追加」をクリック
  //   期待: 作業内容の選択欄（def-select）の数がクリック前より増える
  it("adds a new row on 行追加 click", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 作業内容（time_work）の解析が終わり、作業時間の行が表示されるまで待つ
    await waitFor(() => {
      expect(screen.getAllByTestId("def-select").length).toBeGreaterThan(0);
    });
    // 準備: クリック前の行数（作業内容の選択欄の数）を記録する
    const defSelectsBefore = screen.getAllByTestId("def-select").length;
    // 操作: 「行追加」ボタンをクリック
    const addBtn = screen.getByRole("button", { name: "行追加" });
    fireEvent.click(addBtn);
    // 検証: 行数が増えている
    await waitFor(() => {
      expect(screen.getAllByTestId("def-select").length).toBeGreaterThan(defSelectsBefore);
    });
  });

  // 【テスト】「行削除」ボタンで作業時間の最後の行が削除されること
  //   前提: 取得した工数データから作業時間の行が1行作られている
  //   操作: 「行追加」で1行増やした後、「行削除」をクリック
  //   期待: 時刻入力欄（time-picker、1行に開始/終了の2つ）の数が行削除前より減る
  it("removes last row on 行削除 click", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 「行追加」で1行増やし、その時点の時刻入力欄の数を記録する
    const addBtn = screen.getByRole("button", { name: "行追加" });
    fireEvent.click(addBtn);
    const timePickersAfterAdd = screen.getAllByTestId("time-picker").length;
    // 操作: 「行削除」ボタンをクリックし、時刻入力欄の数を数え直す
    const removeBtn = screen.getByRole("button", { name: "行削除" });
    fireEvent.click(removeBtn);
    const timePickersAfterRemove = screen.getAllByTestId("time-picker").length;
    // 検証: 行削除後のほうが少ない
    expect(timePickersAfterRemove).toBeLessThan(timePickersAfterAdd);
  });

  // 【テスト】「就業日更新」ボタンが表示されること
  //   前提: APIは工数データを返す
  //   操作: 画面を表示する
  //   期待: 名前が「就業日更新」のボタンがある
  it("shows 就業日更新 button", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 検証: 「就業日更新」ボタンがある
    expect(screen.getByRole("button", { name: "就業日更新" })).toBeInTheDocument();
  });

  // 【テスト】「就業日更新」ボタンで就業日変更APIが呼ばれること
  //   前提: PUT は成功を返す
  //   操作: 画面表示後に「就業日更新」をクリック
  //   期待: api.put が "/api/day_update/" と送信データ（工数データ一式）付きで呼ばれる
  it("calls handleSendDayUpdate on 就業日更新 click", async () => {
    // 準備: PUT は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「就業日更新」ボタンをクリック
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    // 検証: PUT /api/day_update/ が呼ばれる（送信内容の中身までは確認しない）
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/day_update/", expect.any(Object));
    });
  });

  // 【テスト】作業内容があるとき、工数の棒グラフと工数区分定義表が表示されること
  //   前提: 取得した工数データの作業内容（time_work）が空でない
  //   操作: 画面を表示する
  //   期待: 棒グラフ（bar-chart）と定義表（def-table）のモックが表示される
  it("displays KosuBarChart and DefTable when initialTimeWork exists", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 2つの子部品が表示されるまで待って確認する
    await waitFor(() => {
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("def-table")).toBeInTheDocument();
    });
  });

  // 【テスト】「更新」ボタンで編集内容がPUT送信されること
  //   前提: 就業形態・直が入力済み、残業0分（入力チェックをすべて通過する）、PUT は成功を返す
  //   操作: 画面表示後に「更新」をクリック
  //   期待: api.put が "/api/kosu_update/1/" と送信データ付きで呼ばれる
  it("submits form via PUT", async () => {
    // 準備: PUT は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック（フォーム送信）
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: URL の工数ID（1）を含む PUT /api/kosu_update/1/ が呼ばれる
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/kosu_update/1/", expect.any(Object));
    });
  });

  // 【テスト】通信エラー以外の例外で「不明なエラー」を含む表示になること
  //   前提: APIは response を持たない普通の Error を投げる
  //   操作: 画面を表示する
  //   期待: 「不明なエラー」を含む文字が表示される
  //   ※上の "displays unknown error for non-axios errors" とほぼ同じ内容の確認
  it("handles non-axios error gracefully", async () => {
    // 準備: 1回目のAPI呼び出しで通常の Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("network failure"));
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 正規表現で「不明なエラー」を部分一致検索する
    expect(await screen.findByText(/不明なエラー/)).toBeInTheDocument();
  });

  // 【テスト】残業時間の「+」「-」ボタンをクリックしても画面が壊れないこと
  //   前提: APIは工数データを返す（勤務・直・残業時間の編集切替はOFFのまま）
  //   操作: 「+」と「-」ボタンを1回ずつクリック
  //   期待: 見出し「工数データ編集」が表示されたまま（エラーで落ちない）
  //   ※編集切替がOFFのため両ボタンは無効（disabled）状態で、値の増減自体は確認していない
  it("handles increment and decrement for over_time", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 「+」「-」ボタンは残業時間入力欄（over-time-wrapper）の左右にある
    const plusBtns = screen.getAllByRole("button", { name: "+" });
    const minusBtns = screen.getAllByRole("button", { name: "-" });
    // 操作: 「+」ボタンがあればクリック
    if (plusBtns.length > 0) {
      fireEvent.click(plusBtns[0]);
    }
    // 操作: 「-」ボタンがあればクリック
    if (minusBtns.length > 0) {
      fireEvent.click(minusBtns[0]);
    }
    // 検証: 画面が壊れていないこと（見出しが残っていること）だけを確認する
    expect(screen.getByText("工数データ編集")).toBeInTheDocument();
  });

  // 【テスト】就業形態が未入力のまま「更新」すると入力エラーが表示されること
  //   前提: APIは就業形態（work_time）を空にした工数データを返す
  //   操作: 「更新」をクリック
  //   期待: 「入力必要項目が入力されていません。」が表示される
  it("shows validation error when work_time is missing on submit", async () => {
    // 準備: 就業形態だけ空文字に差し替えたレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, work_time: "" },
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 必須項目未入力のエラーメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("入力必要項目が入力されていません。")).toBeInTheDocument();
    });
  });

  // 【テスト】直が未入力のまま「更新」すると入力エラーが表示されること
  //   前提: APIは直（tyoku2）を空にした工数データを返す
  //   操作: 「更新」をクリック
  //   期待: 「入力必要項目が入力されていません。」が表示される
  it("shows validation error when tyoku2 is missing on submit", async () => {
    // 準備: 直だけ空文字に差し替えたレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, tyoku2: "" },
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 必須項目未入力のエラーメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("入力必要項目が入力されていません。")).toBeInTheDocument();
    });
  });

  // 【テスト】休出以外で残業時間が15分単位でないと入力エラーが表示されること
  //   前提: APIは残業時間を7分にした工数データを返す（就業形態は「通常」）
  //   操作: 「更新」をクリック
  //   期待: 「残業の最小単位は15分です。確認してください。」が表示される
  it("shows overtime validation error (15min unit) on submit", async () => {
    // 準備: 残業時間だけ 7（分）に差し替えたレスポンスを1回だけ返す（7 は15で割り切れない）
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, over_time: 7 },
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 15分単位エラーのメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("残業の最小単位は15分です。確認してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】休出（休日出勤）で残業時間が5分単位でないと休出用の入力エラーが表示されること
  //   前提: APIは就業形態「休出」・残業時間7分の工数データを返す
  //   操作: 「更新」をクリック
  //   期待: 「休出時の残業は(15n+5)分です。確認してください。」が表示される
  it("shows overtime validation error for kyushutsu (5min unit) on submit", async () => {
    // 準備: 就業形態を「休出」、残業時間を 7（分）に差し替えたレスポンスを1回だけ返す（7 は5で割り切れない）
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, work_time: "休出", over_time: 7 },
      },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 休出用の残業エラーメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("休出時の残業は(15n+5)分です。確認してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】作業詳細が100文字を超える行があると入力エラーになり、更新（PUT）されないこと
  //   前提: APIは作業詳細を101文字にした工数データを返す（全枠同じ内容なので行は1行にまとまる）
  //   操作: 「更新」をクリック
  //   期待: 「作業詳細は100文字以内にしてください。」が表示され、api.put は呼ばれない
  it("shows validation error when a row detail exceeds 100 characters", async () => {
    // 準備: 288枠すべての作業詳細を101文字にしたレスポンスを1回だけ返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        kosu_data: { ...mockResponse.data.kosu_data, detail_work: Array(288).fill("あ".repeat(101)).join("$") },
      },
    });
    // 準備: 画面を表示し、作業行（作業詳細の手入力欄）が表示されるまで待つ
    const { container } = render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(container.querySelector("#timeData_detail_0")).toBeInTheDocument();
    });
    // 操作: 「更新」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    // 検証: 文字数エラーのメッセージが表示され、更新APIは呼ばれない
    await waitFor(() => {
      expect(screen.getByText("作業詳細は100文字以内にしてください。")).toBeInTheDocument();
    });
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  // 【テスト】作業詳細に「$」を入力した行があると入力エラーになり、更新（PUT）されないこと
  //   前提: APIは作業詳細「test」の工数データを返す（作業詳細は手入力欄で表示される）
  //   操作: 1行目のロックを外し、作業詳細を「作業$詳細」に書き換えて「更新」をクリック
  //   期待: 「作業詳細に『$』は使用できません。」が表示され、api.put は呼ばれない
  //   ※サーバーは作業詳細を「$」区切りで保存するため、「$」を含む作業詳細は保存できない
  it("shows validation error when a row detail contains $", async () => {
    // 準備: 画面を表示し、作業行（作業詳細の手入力欄）が表示されるまで待つ
    const { container } = render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(container.querySelector("#timeData_detail_0")).toBeInTheDocument();
    });
    // 操作: 1行目のロック切り替えスイッチ（チェックボックスの2番目。1番目は勤務・直・残業欄のロック）をONにする
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    // 操作: 1行目の作業詳細を「$」入りの文字に書き換える
    fireEvent.change(container.querySelector("#timeData_detail_0") as HTMLInputElement, { target: { value: "作業$詳細" } });
    // 操作: 「更新」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    // 検証: 「$」使用エラーのメッセージが表示され、更新APIは呼ばれない
    await waitFor(() => {
      expect(screen.getByText("作業詳細に『$』は使用できません。")).toBeInTheDocument();
    });
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  // 【テスト】作業時間（開始時刻）が未入力の行があると入力エラーになり、更新（PUT）されないこと
  //   前提: APIは作業行1行の工数データを返す
  //   操作: 1行目のロックを外し、開始時刻を消して（未入力にして）「更新」をクリック
  //   期待: 「すべての作業時間を入力してください。」が表示され、api.put は呼ばれない
  it("shows validation error when a row time is empty", async () => {
    // 準備: 画面を表示し、作業行の時刻選択欄が表示されるまで待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByTestId("time-picker").length).toBeGreaterThan(0);
    });
    // 操作: 1行目のロック切り替えスイッチをONにする
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    // 操作: 1行目の開始時刻の選択欄を変更する（モックが onChange(null) を呼び、時刻が未入力になる）
    fireEvent.change(screen.getAllByTestId("time-picker")[0], { target: { value: "x" } });
    // 操作: 「更新」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    // 検証: 作業時間未入力のエラーメッセージが表示され、更新APIは呼ばれない
    await waitFor(() => {
      expect(screen.getByText("すべての作業時間を入力してください。")).toBeInTheDocument();
    });
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  // 【テスト】「＋」ボタンで変更した残業時間が更新（PUT）の送信データに含まれること
  //   前提: APIは残業時間0分・就業形態「通常」の工数データを返す。PUT は成功を返す
  //   操作: 勤務・直・残業欄のロックを外し、「+」を1回クリック（0 → 15分）してから「更新」をクリック
  //   期待: api.put が "/api/kosu_update/1/" と over_time: 15 を含むデータで呼ばれる
  it("sends the changed over_time in the PUT request", async () => {
    // 準備: PUT は成功を返す。画面を表示し、読み込み完了を待つ
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 勤務・直・残業欄のロック切り替えスイッチ（チェックボックスの1番目）をONにする
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    // 操作: 残業時間の「+」ボタンを1回クリック（15分増える）
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    // 操作: 「更新」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    // 検証: 変更後の残業時間 15 を含むデータで更新APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith(
        "/api/kosu_update/1/",
        expect.objectContaining({ over_time: 15 })
      );
    });
  });

  // 【テスト】更新（PUT）が401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: PUT は1回目の呼び出しで status 401 のエラーを返す
  //   操作: 「更新」をクリック
  //   期待: navigate("/login") が呼ばれる
  it("handles submit PUT error (401)", async () => {
    // 準備: PUT を 401 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】更新（PUT）が500を返したら「Error: サーバーからのメッセージ」が表示されること
  //   前提: PUT は status 500・message "更新エラー" のエラーを返す
  //   操作: 「更新」をクリック
  //   期待: 「Error: 更新エラー」が表示される
  it("handles submit PUT server error", async () => {
    // 準備: PUT を 500 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockRejectedValueOnce({ response: { status: 500, data: { message: "更新エラー" } } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 画面全体がエラー表示に置き換わる
    await waitFor(() => {
      expect(screen.getByText("Error: 更新エラー")).toBeInTheDocument();
    });
  });

  // 【テスト】更新（PUT）で通信エラー以外の例外が起きたら「Error: 不明なエラー…」が表示されること
  //   前提: PUT は response を持たない普通の Error を投げる
  //   操作: 「更新」をクリック
  //   期待: 「Error: 不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("handles submit PUT non-axios error", async () => {
    // 準備: PUT で通常の Error を投げるようにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 不明なエラー用の固定メッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】作業時間の行の「削除」ボタンで行削除APIがPOST送信されること
  //   前提: 作業時間の行が1行あり（初期状態は入力不可）、POST は成功を返す
  //   操作: 1行目の入力可否スイッチをONにしてから、有効になった「削除」ボタンをクリック
  //   期待: api.post が "/api/item_delete/" と送信データ付きで呼ばれる
  //   ※有効な「削除」ボタンが見つからない場合は検証自体が行われない書き方になっている
  it("handles item delete via POST", async () => {
    // 準備: POST は空データで成功を返すようにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 作業内容の解析が終わり、行ごとの「削除」ボタンが表示されるまで待つ
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole("button", { name: "削除" });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
    // 準備: 「削除」ボタンを取得（この変数は以降では使われていない）
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    // 準備: 行は初期状態で入力不可（削除ボタンも無効）のため、先にその行のスイッチ（チェックボックス）をONにする
    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] は勤務・直・残業時間の編集切替、[1] は1行目の入力可否切替
    // （その後ろに作業詳細の入力方式切替などが続く）
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]); // 1行目を入力可能にする
    }
    // 操作: 無効（disabled）になっていない「削除」ボタンを探してクリック
    const enabledDeleteBtns = screen.getAllByRole("button", { name: "削除" });
    const enabledBtn = enabledDeleteBtns.find(btn => !(btn as HTMLButtonElement).disabled);
    if (enabledBtn) {
      fireEvent.click(enabledBtn);
      // 検証: POST /api/item_delete/ が呼ばれる（送信内容の中身までは確認しない）
      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith("/api/item_delete/", expect.any(Object));
      });
    }
  });

  // 【テスト】行削除（POST）が401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: POST は1回目の呼び出しで status 401 のエラーを返す
  //   操作: 1行目の入力可否スイッチをONにしてから、有効になった「削除」ボタンをクリック
  //   期待: navigate("/login") が呼ばれる
  //   ※有効な「削除」ボタンが見つからない場合は検証自体が行われない書き方になっている
  it("handles item delete POST error (401)", async () => {
    // 準備: POST を 401 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 行ごとの「削除」ボタンが表示されるまで待つ
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "削除" }).length).toBeGreaterThan(0);
    });
    // 準備: 1行目の入力可否スイッチ（checkboxes[1]）をONにして削除ボタンを有効にする
    const checkboxes = screen.getAllByRole("checkbox");
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]);
    }
    // 操作: 有効な「削除」ボタンを探してクリック
    const enabledBtn = screen.getAllByRole("button", { name: "削除" }).find(btn => !(btn as HTMLButtonElement).disabled);
    if (enabledBtn) {
      fireEvent.click(enabledBtn);
      // 検証: ログイン画面（"/login"）への遷移が呼ばれる
      await waitFor(() => {
        expect(mockedNavigate).toHaveBeenCalledWith("/login");
      });
    }
  });

  // 【テスト】就業日更新（PUT）が401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: PUT は1回目の呼び出しで status 401 のエラーを返す
  //   操作: 「就業日更新」をクリック
  //   期待: navigate("/login") が呼ばれる
  it("handles day update PUT error (401)", async () => {
    // 準備: PUT を 401 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「就業日更新」ボタンをクリック
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】就業日更新（PUT）が500を返したら「Error: サーバーからのメッセージ」が表示されること
  //   前提: PUT は status 500・message "日付更新エラー" のエラーを返す
  //   操作: 「就業日更新」をクリック
  //   期待: 「Error: 日付更新エラー」が表示される
  it("handles day update PUT server error", async () => {
    // 準備: PUT を 500 エラーにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockRejectedValueOnce({ response: { status: 500, data: { message: "日付更新エラー" } } });
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「就業日更新」ボタンをクリック
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    // 検証: 画面全体がエラー表示に置き換わる
    await waitFor(() => {
      expect(screen.getByText("Error: 日付更新エラー")).toBeInTheDocument();
    });
  });

  // 【テスト】就業日更新（PUT）で通信エラー以外の例外が起きたら「Error: 不明なエラー…」が表示されること
  //   前提: PUT は response を持たない普通の Error を投げる
  //   操作: 「就業日更新」をクリック
  //   期待: 「Error: 不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("handles day update PUT non-axios error", async () => {
    // 準備: PUT で通常の Error を投げるようにし、画面を表示して読み込み完了を待つ
    mockedApi.put.mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: 「就業日更新」ボタンをクリック
    const dayUpdateBtn = screen.getByRole("button", { name: "就業日更新" });
    fireEvent.click(dayUpdateBtn);
    // 検証: 不明なエラー用の固定メッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
    });
  });

  // 【テスト】勤務・直・残業時間の編集切替スイッチをONにできること
  //   前提: 初期状態では編集切替はOFF（勤務・直・残業時間は入力不可）
  //   操作: 先頭のチェックボックス（編集切替スイッチ）をクリック
  //   期待: クリック前はチェックなし、クリック後はチェックありになる
  it("toggles work/tyoku edit mode checkbox", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 先頭のチェックボックスが勤務・直・残業時間の編集切替スイッチ
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    // 検証: 初期状態は isWorkTyokuDisabled（編集不可フラグ）が true のため、チェックは外れている
    expect(checkboxes[0]).not.toBeChecked();
    // 操作: スイッチをクリック
    fireEvent.click(checkboxes[0]);
    // 検証: チェックが入る（編集可能になる）
    expect(checkboxes[0]).toBeChecked();
  });

  // 【テスト】就業日の入力欄を書き換えると値が反映されること
  //   前提: 工数データの就業日は 2025-01-01
  //   操作: 就業日欄を 2025-06-15 に変更
  //   期待: 入力欄の値が "2025-06-15" になる
  it("changes work_day2 input", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 操作: ラベル「就業日」の入力欄を取得し、name 付きで値を変更する（name で formData の更新先が決まる）
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { name: "work_day2", value: "2025-06-15" } });
    // 検証: 入力欄に新しい日付が表示される
    expect(dateInput).toHaveValue("2025-06-15");
  });

  // 【テスト】データ取得で通信エラー以外の例外が起きたら「不明なエラー」が表示されること
  //   前提: APIは response を持たない普通の Error を投げる
  //   操作: 画面を表示する
  //   期待: 「不明なエラーが発生しました」を含む文字が表示される
  //   ※"displays unknown error for non-axios errors" とほぼ同じ内容の確認
  it("API取得で非Axiosエラー時にエラー表示すること", async () => {
    // 準備: 1回目のAPI呼び出しで通常の Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("network"));
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 正規表現で部分一致検索する
    expect(await screen.findByText(/不明なエラーが発生しました/)).toBeInTheDocument();
  });

  // 【テスト】残業時間の入力欄を書き換えても画面が壊れないこと
  //   前提: APIは工数データを返す
  //   操作: 編集切替スイッチをONにしてから、残業時間欄に 30 を入力
  //   期待: 見出し「工数データ編集」が表示されたまま（エラーで落ちない）
  //   ※入力欄の値が 30 になったかまでは確認していない
  it("handles over_time input change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    await screen.findByText("工数データ編集");
    // 準備: 先に勤務・直・残業時間の編集切替スイッチ（先頭のチェックボックス）をONにして入力可能にする
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // 編集切替をONにする
    // 操作: 残業時間欄（id="over_time"）を 30 に変更
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    fireEvent.change(overTimeInput, { target: { name: "over_time", value: "30" } });
    // 検証: 画面が壊れていないこと（見出しが残っていること）だけを確認する
    expect(screen.getByText("工数データ編集")).toBeInTheDocument();
  });

  // 【テスト】データ取得で500エラーが起きたらサーバーからのメッセージが表示されること
  //   前提: APIは status 500・message "サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「サーバーエラー」を含む文字が表示される
  //   ※"displays error message when API returns non-401 error" とほぼ同じ内容の確認
  it("サーバーエラー時にエラーメッセージが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><KosuEdit /></MemoryRouter>);
    // 検証: 正規表現で「サーバーエラー」を部分一致検索する
    expect(await screen.findByText(/サーバーエラー/)).toBeInTheDocument();
  });
});
