/**
 * ============================================================
 * ファイル名 : DefEdit.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefEdit.tsx（工数区分定義編集画面）
 * 概要       : 定義データの取得とフォームへの反映・各入力欄の変更・
 *              更新確認ダイアログでのOK/キャンセル・PUT送信・エラー時（401/403/500/通信以外）の挙動を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :id を "1" に固定するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
 *   - window.alert / window.confirm : ブラウザのダイアログを出さず、OK/キャンセルの結果を指定するため
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
// （useParams は URL の :id＝編集対象の工数区分定義VerのIDを "1" に固定する。それ以外の機能は本物を使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefEdit from "../../DefinitionPage/DefEdit";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_update/1/ のレスポンス例（工数区分定義Ver名「テスト定義」）
const mockData: any = { kosu_name: "テスト定義" };
// 工数区分1〜50の項目を作る。工数区分名は1番目だけ「作業A」、残りは空
for (let i = 1; i <= 50; i++) {
  mockData[`kosu_title_${i}`] = i === 1 ? "作業A" : ""; // 工数区分名
  mockData[`kosu_division_1_${i}`] = ""; // 定義
  mockData[`kosu_division_2_${i}`] = ""; // 作業内容
  mockData[`kosu_division_3_${i}`] = false; // 変動/固定の切り替え（false: スイッチOFF）
}

// ============================================================
// テスト本体
// ============================================================

// DefEdit 画面の表示・入力・更新送信・エラー処理をまとめて確認するテストグループ
describe("DefEdit", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、ダイアログとAPIの既定の振る舞いを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 更新完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 更新確認ダイアログは既定で「OK」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // 定義データ取得APIは常に上の mockData を返す
    mockedApi.get.mockResolvedValue({ data: mockData });
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは定義Ver「テスト定義」のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数区分定義編集」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数区分定義編集")).toBeInTheDocument();
  });

  // 【テスト】表示時に URL の :id を使って編集対象の定義データを取得すること
  //   前提: useParams は id="1" を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_update/1/" で呼ばれる
  it("loads data from API with correct endpoint", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // 検証: 定義データ取得APIが ID=1 のURLで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_update/1/");
    });
  });

  // 【テスト】定義データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得した定義Ver名がフォームの入力欄に初期値として入ること
  //   前提: APIは kosu_name="テスト定義" を返す
  //   操作: 画面を表示する
  //   期待: 値が「テスト定義」の入力欄が存在する
  it("displays the kosu_name in form", async () => {
    // 操作: 画面を表示し、値が「テスト定義」の入力欄を探す（表示テキストではなく value で探す）
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    const nameInput = await screen.findByDisplayValue("テスト定義");
    // 検証: 該当する入力欄がある
    expect(nameInput).toBeInTheDocument();
  });

  // 【テスト】「更新」ボタンで確認ダイアログが出て、OKなら PUT で送信されること
  //   前提: 確認ダイアログはOK、更新APIは成功を返す
  //   操作: 「更新」ボタン（フォームの上部と下部に2つある）のうち1つ目をクリック
  //   期待: window.confirm が呼ばれ、api.put が "/api/def_update/1/" と送信データ付きで呼ばれる
  it("submits form via PUT with confirm", async () => {
    // 準備: 更新APIを成功させる
    mockedApi.put.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 「更新」ボタンは上下2か所にあるため全件取得し、1つ目をクリック
    const submitBtns = screen.getAllByRole("button", { name: "更新" });
    fireEvent.click(submitBtns[0]);
    // 検証: 確認ダイアログが表示され、OK後に工数区分1〜50をまとめたデータで PUT が呼ばれる
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApi.put).toHaveBeenCalledWith("/api/def_update/1/", expect.any(Object));
    });
  });

  // 【テスト】確認ダイアログでキャンセルすると送信されないこと
  //   前提: 確認ダイアログはキャンセル（false）を返す
  //   操作: 1つ目の「更新」ボタンをクリック
  //   期待: api.put が一度も呼ばれない
  it("does not submit when confirm is cancelled", async () => {
    // 準備: このテストだけ確認ダイアログで「キャンセル」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(false);
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 1つ目の「更新」ボタンをクリック
    const submitBtns = screen.getAllByRole("button", { name: "更新" });
    fireEvent.click(submitBtns[0]);
    // 検証: キャンセルしたので更新APIは呼ばれない
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  // 【テスト】定義データ取得APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】工数区分定義一覧へ戻るリンクが表示されること
  //   前提: APIは定義データを返す
  //   操作: 画面を表示する
  //   期待: 「工数区分定義一覧」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 検証: ナビゲーション欄に一覧画面へのリンクがある
    expect(screen.getByText("工数区分定義一覧")).toBeInTheDocument();
  });

  // 【テスト】工数区分ごとの入力欄（ブロック）が描画されること
  //   前提: APIは工数区分1〜50の項目を返す
  //   操作: 画面を表示する
  //   期待: 1番目の工数区分名の入力欄（id="kosu_title_1"）が存在する
  it("displays definition block inputs", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 検証: 1番目の工数区分名の入力欄が id で見つかる
    expect(document.getElementById("kosu_title_1")).toBeInTheDocument();
  });

  // 【テスト】定義Ver名の入力欄を変更すると値が反映されること
  //   前提: 初期値は「テスト定義」
  //   操作: 定義Ver名の入力欄（id="kosu_name"）に「新Ver」を入力
  //   期待: 入力欄の値が「新Ver」になる
  it("handles kosu_name change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 定義Ver名の入力欄を変更する（画面側は name 属性で更新する項目を判断するため name も渡す）
    const nameInput = document.getElementById("kosu_name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: "kosu_name", value: "新Ver" } });
    // 検証: state が更新され、入力欄の値が変わる
    expect(nameInput).toHaveValue("新Ver");
  });

  // 【テスト】工数区分名の入力欄を変更すると値が反映されること
  //   前提: 1番目の工数区分名の初期値は「作業A」
  //   操作: 1番目の工数区分名（id="kosu_title_1"）に「新作業」を入力
  //   期待: 入力欄の値が「新作業」になる
  it("handles definition title change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 1番目の工数区分名の入力欄を変更する
    const titleInput = document.getElementById("kosu_title_1") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "新作業" } });
    // 検証: 入力欄の値が変わる
    expect(titleInput).toHaveValue("新作業");
  });

  // 【テスト】工数区分の「定義」欄を変更すると値が反映されること
  //   前提: 1番目の工数区分の定義は空
  //   操作: 1番目の工数区分の定義（id="kosu_division_1_1"）に「新定義」を入力
  //   期待: テキストエリアの値が「新定義」になる
  it("handles definition division1 change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 定義のテキストエリアを変更する
    // （画面上の id は「kosu_division_{工数区分の番号}_{1:定義 / 2:作業内容 / 3:変動固定}」の形式）
    const divInput = document.getElementById("kosu_division_1_1") as HTMLTextAreaElement;
    fireEvent.change(divInput, { target: { value: "新定義" } });
    // 検証: テキストエリアの値が変わる
    expect(divInput).toHaveValue("新定義");
  });

  // 【テスト】変動/固定の切り替えスイッチ（チェックボックス）をクリックするとONになること
  //   前提: 1番目の工数区分の変動/固定は false（OFF）
  //   操作: 1番目の工数区分の変動/固定（id="kosu_division_1_3"）をクリック
  //   期待: チェックが入った状態になる
  it("handles checkbox change for division3", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 1番目の工数区分の変動/固定チェックボックスをクリック
    const checkbox = document.getElementById("kosu_division_1_3") as HTMLInputElement;
    fireEvent.click(checkbox);
    // 検証: OFF → ON に切り替わる
    expect(checkbox).toBeChecked();
  });

  // 【テスト】更新APIがエラーを返したら、サーバーからのメッセージを画面に表示すること
  //   前提: 更新APIは status 500・message="更新エラー" のエラーを返す（確認ダイアログはOK）
  //   操作: 1つ目の「更新」ボタンをクリック
  //   期待: 「更新エラー」が表示される
  it("handles PUT error with server message", async () => {
    // 準備: 1回目の更新API呼び出しを 500 エラーにする
    mockedApi.put.mockRejectedValueOnce({
      response: { status: 500, data: { message: "更新エラー" } },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    await screen.findByText("工数区分定義編集");
    // 操作: 1つ目の「更新」ボタンをクリック
    const submitBtns = screen.getAllByRole("button", { name: "更新" });
    fireEvent.click(submitBtns[0]);
    // 検証: 401/403 以外のエラーなので、サーバーのメッセージがフォーム上部に表示される
    expect(await screen.findByText("更新エラー")).toBeInTheDocument();
  });

  // 【テスト】通信以外のエラー（response を持たないエラー）でも画面が壊れずに表示されること
  //   前提: 定義データ取得APIは通常の Error（response なし）を投げる
  //   操作: 画面を表示する
  //   期待: 見出し・「エラー」を含む文字・「データが見つかりません」のいずれかが表示される
  it("displays error for non-axios error", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる（isAxiosError のモックは false を返す）
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    // 操作: 画面を表示
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // 検証: エラー後の画面として、3つの表示のうちどれか1つが出ていればよい
    // （実際の画面は定義データが未設定のため「データが見つかりません」を表示する）
    await waitFor(() => {
      expect(screen.queryByText("工数区分定義編集") || screen.queryByText(/エラー/) || screen.queryByText("データが見つかりません")).toBeTruthy();
    });
  });

  // 【テスト】APIが空のデータ（null）を返したら「データが見つかりません」と表示すること
  //   前提: 定義データ取得APIは data: null を返す
  //   操作: 画面を表示する
  //   期待: 「データが見つかりません」が表示される
  it("displays データが見つかりません when no data", async () => {
    // 準備: 1回目のAPI呼び出しで data が null のレスポンスを返す
    // （画面側では null の項目を読もうとして例外になり、定義データが未設定のままになる）
    mockedApi.get.mockResolvedValueOnce({ data: null });
    // 操作: 画面を表示
    render(<MemoryRouter><DefEdit /></MemoryRouter>);
    // 検証: 定義データがない場合の文言が表示される
    expect(await screen.findByText("データが見つかりません")).toBeInTheDocument();
  });
});
