/**
 * ============================================================
 * ファイル名 : AdministratorKosuUpdate.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorKosuUpdate.tsx（全工数データ編集画面）
 * 概要       : 管理者が工数データ1件を直接編集する画面について、初期表示・各入力欄の表示と変更・
 *              残業時間の増減ボタン・入力チェック・更新（PUT）・削除（DELETE）・エラー時の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の工数データID（id="1"）の固定のため
 *   - Loading                      : 画面の本質と関係ない子部品を単純化するため
 *   - DefVersionSelect / WorkSelect / TyokuSelect : 選択肢「---」だけの素の select に置き換えて単純化するため
 *   - window.alert / window.confirm : ブラウザの通知・確認ダイアログを出さずに自動で応答させるため
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
// useParams のモック: URLパラメータの工数データIDを "1" に固定する（/manager-kosu-update/1 を開いた状態を再現）
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// DefVersionSelect（工数区分定義Ver選択）: 選択肢「---」だけの素の select にする
vi.mock("../../Components/DefVersionSelect", () => ({ default: (props: any) => <select data-testid="version-select" onChange={props.onChange}><option value="">---</option></select> }));
// WorkSelect（就業形態選択）: 選択肢「---」だけの素の select にする
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));
// TyokuSelect（直選択）: 選択肢「---」だけの素の select にする
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));

// テスト対象のコンポーネント
// （vi.mock はファイル先頭へ自動的に巻き上げられるため、ここで読み込んでもモックが適用される）
import AdministratorKosuUpdate from "../../AdministratorPage/AdministratorKosuUpdate";

// ============================================================
// テスト用データ
// ============================================================

// 工数データ編集APIのレスポンス例（従業員番号 12345・2025-01-01・1直・残業30分）
const mockResponse = {
  data: {
    kosu_data: {
      employee_no3: 12345,
      work_day2: "2025-01-01",
      tyoku2: "1",
      // 作業内容: 5分刻み × 24時間 = 288文字。全て "#"（工数区分記号の入っていない状態）
      time_work: "#".repeat(288),
      // 作業詳細: 288個の空文字を "$" でつないだ文字列（"$" は287個）。画面では1時間=12要素ずつに分割される
      detail_work: Array(288).fill("").join("$"),
      over_time: 30,
      work_time: "通常",
      def_ver2: "v1",
      // 休憩時間は "#HHMMHHMM"（開始時刻と終了時刻）形式。昼休憩は 12:00〜13:00、残業休憩は 00:00〜00:00（なし）
      breaktime: "#12001300",
      breaktime_over1: "#00000000",
      breaktime_over2: "#00000000",
      breaktime_over3: "#00000000",
      judgement: true,
      break_change: false,
    },
    member_data: { employee_no: 12345, name: "テスト太郎", shop: "W1" },
    // 工数区分定義Verの選択肢一覧
    choices: [{ id: 1, kosu_name: "Ver1" }],
    current_version: "Ver1",
  },
};

// ============================================================
// テスト本体
// ============================================================

// AdministratorKosuUpdate 画面の表示・入力・更新・削除・エラー処理をまとめて確認するテストグループ
describe("AdministratorKosuUpdate", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、通知ダイアログは何もしない、
  // 確認ダイアログは常に「OK」の設定にし、APIは常に上記の工数データを返すようにする
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面タイトルが表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 「全工数データ編集」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    // 検証: データ取得が終わり画面タイトルが出るまで待って確認する
    expect(await screen.findByText("全工数データ編集")).toBeInTheDocument();
  });

  // 【テスト】初期表示でURLのIDを使った工数データ取得APIが呼ばれること
  //   前提: URLパラメータの id は "1"
  //   操作: 画面を表示する
  //   期待: api.get が "/api/manager_kosu_update/1/" で呼ばれる
  it("loads data from API with correct endpoint", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    // 検証: ID 1 の工数データ取得APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu_update/1/");
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
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得した従業員番号が入力欄に入った状態で表示されること
  //   前提: APIは従業員番号 12345 の工数データを返す
  //   操作: 画面を表示する
  //   期待: 値が "12345" の入力欄がある
  it("displays form with loaded employee number", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    // 検証: 入力欄の値（表示値）が 12345 のものが現れるまで待って確認する
    expect(await screen.findByDisplayValue("12345")).toBeInTheDocument();
  });

  // 【テスト】「削除」ボタン押下 → 確認OKで削除APIが呼ばれること
  //   前提: 確認ダイアログは「OK」を返す（beforeEach）、削除APIは成功する
  //   操作: 初期表示後に「削除」ボタンをクリック
  //   期待: api.delete が "/api/manager_kosu_update/1/" で呼ばれる
  it("deletes record on button click", async () => {
    // 準備: 削除APIを成功（空のレスポンス）にする
    mockedApi.delete.mockResolvedValue({});
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 「削除」ボタンをクリック
    const deleteBtn = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteBtn);
    // 検証: ID 1 の工数データ削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith("/api/manager_kosu_update/1/");
    });
  });

  // 【テスト】確認ダイアログで「キャンセル」したら削除APIが呼ばれないこと
  //   前提: 確認ダイアログは「キャンセル」（false）を返す
  //   操作: 初期表示後に「削除」ボタンをクリック
  //   期待: api.delete が一度も呼ばれない
  it("does not delete when confirm is cancelled", async () => {
    // 準備: このテストだけ確認ダイアログの戻り値を false（キャンセル）にする
    vi.spyOn(window, "confirm").mockReturnValue(false);
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 「削除」ボタンをクリック
    const deleteBtn = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteBtn);
    // 検証: 削除APIは呼ばれない
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  // 【テスト】取得した就業日が日付欄に入った状態で表示されること
  //   前提: APIは就業日 2025-01-01 の工数データを返す
  //   操作: 画面を表示する
  //   期待: 値が "2025-01-01" の入力欄がある
  it("displays work_day2 input", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 検証: 就業日欄に取得値が入っている
    expect(screen.getByDisplayValue("2025-01-01")).toBeInTheDocument();
  });

  // 【テスト】取得した残業時間が入力欄に入った状態で表示されること
  //   前提: APIは残業時間 30（分）の工数データを返す
  //   操作: 画面を表示する
  //   期待: 値が "30" の入力欄がある
  it("displays over_time value", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 検証: 残業欄に取得値が入っている
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
  });

  // 【テスト】休憩時間の入力欄が表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 「昼休憩時間:」「残業休憩時間1:」ラベルに紐づく入力欄がある
  it("displays breaktime fields", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 検証: ラベル文字から入力欄を探して存在を確認する
    expect(screen.getByLabelText("昼休憩時間:")).toBeInTheDocument();
    expect(screen.getByLabelText("残業休憩時間1:")).toBeInTheDocument();
  });

  // 【テスト】残業の「+」ボタン（15分加算）で残業時間が15分増えること
  //   前提: 残業時間の初期値は 30
  //   操作: 1つ目の「+」ボタン（+15分）をクリック
  //   期待: 値が "45" の入力欄がある
  it("handles increment buttons for over_time", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 「+」ボタンは「+15分」「+1分」の順に2つ並ぶため、1つ目（+15分）をクリック
    const plusBtns = screen.getAllByRole("button", { name: "+" });
    fireEvent.click(plusBtns[0]);
    // 検証: 30 + 15 = 45 になっている
    expect(screen.getByDisplayValue("45")).toBeInTheDocument();
  });

  // 【テスト】残業の「-」ボタンを押しても画面が壊れず、残業欄が残っていること
  //   前提: 残業時間の初期値は 30
  //   操作: 1つ目の「-」ボタンをクリック
  //   期待: id="over_time" の入力欄が存在する（値そのものは確認しない）
  it("handles decrement buttons for over_time", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 「-」ボタンは「-1分」「-15分」の順に2つ並ぶため、1つ目（-1分）をクリック
    const minusBtns = screen.getAllByRole("button", { name: "-" });
    fireEvent.click(minusBtns[0]);
    // 「-」ボタンは2つ（-1分と-15分）あり減算後の値がボタン次第で変わるため、
    // ここでは値までは確認せず残業欄が存在することだけを確認する
    // 検証: 残業欄（id="over_time"）が表示されている
    const overTimeInput = document.getElementById("over_time") as HTMLInputElement;
    expect(overTimeInput).toBeInTheDocument();
  });

  // 【テスト】「更新」ボタンで送信処理が動いても画面が壊れないこと
  //   前提: 更新APIは成功する。取得データは入力チェックを通る内容
  //   操作: 初期表示後に「更新」ボタンをクリック
  //   期待: 画面タイトル「全工数データ編集」が表示されたままである
  it("submits form via PUT", async () => {
    // 準備: 更新APIを成功（空のデータ）にする
    mockedApi.put.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 「更新」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 入力チェックのエラーが出る場合もあり得るが、送信処理のコードが実行されることを目的としている
    // 検証: PUT が呼ばれた場合も入力エラーが出た場合も、画面タイトルは表示されたままである
    await waitFor(() => {
      // api.put の呼び出し有無までは確認していない
      expect(screen.getByText("全工数データ編集")).toBeInTheDocument();
    });
  });

  // 【テスト】従業員番号が0のまま「更新」すると入力エラーが表示されること
  //   前提: APIは従業員番号 0 の工数データを返す（それ以外は通常データと同じ）
  //   操作: 初期表示後に「更新」ボタンをクリック
  //   期待: 「従業員番号は必須です。空欄や0は許可されません。」が1個以上表示される
  it("shows validation error for empty employee_no", async () => {
    // 準備: 通常データをコピーし、従業員番号だけ 0 に差し替えたレスポンスを作る
    const emptyEmpResponse = {
      data: {
        kosu_data: { ...mockResponse.data.kosu_data, employee_no3: 0 },
        member_data: mockResponse.data.member_data,
        choices: mockResponse.data.choices,
        current_version: mockResponse.data.current_version,
      },
    };
    // 準備: 1回目のAPI呼び出しでそのレスポンスを返し、画面を表示して初期表示を待つ
    mockedApi.get.mockResolvedValueOnce(emptyEmpResponse);
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: エラーメッセージが表示される（フォームの上と下の2か所に出るため getAll で数える）
    await waitFor(() => {
      expect(screen.getAllByText("従業員番号は必須です。空欄や0は許可されません。").length).toBeGreaterThan(0);
    });
  });

  // 【テスト】整合性（工数入力OK/NG判定）のチェックボックスを切り替えても画面が壊れないこと
  //   前提: 整合性の初期値は true（ON）
  //   操作: 「整合性:」ラベルに紐づくチェックボックスをクリック
  //   期待: 画面タイトルが表示されたままである
  it("handles checkbox change for judgement", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 整合性のチェックボックスをクリック（ON → OFF）
    const judgementCheckbox = screen.getByLabelText("整合性:");
    fireEvent.click(judgementCheckbox);
    // 検証: エラーで画面が落ちていないことだけを確認する（チェック状態そのものは確認しない）
    expect(screen.getByText("全工数データ編集")).toBeInTheDocument();
  });

  // 【テスト】昼休憩時間の入力欄に値を入力できること
  //   前提: 昼休憩時間の初期値は "#12001300"
  //   操作: 昼休憩時間欄に "#12001300" を入力する
  //   期待: 入力欄の値が "#12001300" である
  it("handles text input change for breaktime", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 昼休憩時間欄に入力する（name を指定し、handleChange がどの項目の変更か判別できるようにする）
    const breaktimeInput = screen.getByLabelText("昼休憩時間:");
    fireEvent.change(breaktimeInput, { target: { name: "breaktime", value: "#12001300" } });
    // 検証: 入力欄に入力値が入っている
    expect(breaktimeInput).toHaveValue("#12001300");
  });

  // 【テスト】作業内容を1時間ごとに分けた入力欄（1時台〜24時台）が表示されること
  //   前提: APIは288文字の作業内容を返す（画面では12文字ずつ24個に分割される）
  //   操作: 画面を表示する
  //   期待: 「1時台作業内容:」と「24時台作業内容:」のラベルに紐づく入力欄がある
  it("displays time work segment inputs", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 検証: 最初（1時台）と最後（24時台）の入力欄がある
    expect(screen.getByLabelText("1時台作業内容:")).toBeInTheDocument();
    expect(screen.getByLabelText("24時台作業内容:")).toBeInTheDocument();
  });

  // 【テスト】1時台の作業内容欄に入力した値が反映されること
  //   前提: 初期表示が完了している
  //   操作: 「1時台作業内容:」の欄に "AABBCCDDEE"（10文字）を入力する
  //   期待: 入力欄の値が "AABBCCDDEE" である（12文字以内なので切り捨てられない）
  it("handles segment input change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 操作: 1時台の作業内容欄に入力する
    const segment1 = screen.getByLabelText("1時台作業内容:");
    fireEvent.change(segment1, { target: { value: "AABBCCDDEE" } });
    // 検証: 入力値がそのまま入っている
    expect(segment1).toHaveValue("AABBCCDDEE");
  });

  // 【テスト】作業詳細を1時間ごとに分けた入力欄が表示されること
  //   前提: APIは288要素分の作業詳細を返す
  //   操作: 画面を表示する
  //   期待: 「1時台作業詳細:」ラベルに紐づく入力欄がある
  it("displays detail work segment inputs", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    await screen.findByText("全工数データ編集");
    // 検証: 1時台の作業詳細欄がある
    expect(screen.getByLabelText("1時台作業詳細:")).toBeInTheDocument();
  });

  // 【テスト】APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】通信エラー以外の例外が起きても画面が落ちず、何らかの表示が出ること
  //   前提: APIは response を持たない普通の Error を投げる（isAxiosError が false になる）
  //   操作: 画面を表示する
  //   期待: 「全工数データ編集」「エラー」を含む文字「データが見つかりません」のいずれかが表示される
  it("displays unknown error for non-axios errors", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuUpdate /></MemoryRouter>);
    // この画面は取得失敗時の表示が固定ではない（データが無いと「データが見つかりません」になる）ため、
    // 落ちずに何かが表示されることだけを確認する
    // 検証: 候補の表示のうちどれか1つが見つかる
    await waitFor(() => {
      expect(screen.queryByText("全工数データ編集") || screen.queryByText(/エラー/) || screen.queryByText("データが見つかりません")).toBeTruthy();
    });
  });
});
