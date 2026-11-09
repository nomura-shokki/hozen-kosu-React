/**
 * ============================================================
 * ファイル名 : MemberEdit.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MemberPage/MemberEdit.tsx（人員データ編集画面）
 * 概要       : 人員データの取得とフォームへの反映・入力欄/権限スイッチの変更・
 *              「更新」ボタンでの PUT 送信・エラー時（401/403）の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :employee_no を "12345" に固定するため
 *   - Loading / ShopSelect         : 画面の本質と関係ない子部品を単純化するため
 *   - window.alert                 : 更新完了メッセージのダイアログを出さないため
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
// （useParams は URL の :employee_no＝編集対象の従業員番号を "12345" に固定する。それ以外の機能は本物を使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ employee_no: "12345" }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// ShopSelect（ショップのプルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import MemberEdit from "../../MemberPage/MemberEdit";

// ============================================================
// テストデータ
// ============================================================

// GET /api/member_update/12345/ のレスポンス例（編集対象の人員データ）
const mockMember = {
  data: {
    employee_no: 12345, // 従業員番号
    name: "テスト太郎", // 氏名
    shop: "W1", // ショップ
    authority: true, // 権限（true: スイッチON）
    administrator: false, // 管理者（false: スイッチOFF）
    // 休憩時間（"#HHMMHHMM" 形式＝開始時刻と終了時刻。ここではすべて 00:00〜00:00）
    // break_timeN: N直の昼休憩 / break_timeN_over1〜3: N直の残業休憩1〜3
    // （N は 1:1直 / 2:2直 / 3:3直 / 4:常昼 / 5:連1直 / 6:連2直）
    break_time1: "#00000000",
    break_time1_over1: "#00000000",
    break_time1_over2: "#00000000",
    break_time1_over3: "#00000000",
    break_time2: "#00000000",
    break_time2_over1: "#00000000",
    break_time2_over2: "#00000000",
    break_time2_over3: "#00000000",
    break_time3: "#00000000",
    break_time3_over1: "#00000000",
    break_time3_over2: "#00000000",
    break_time3_over3: "#00000000",
    break_time4: "#00000000",
    break_time4_over1: "#00000000",
    break_time4_over2: "#00000000",
    break_time4_over3: "#00000000",
    break_time5: "#00000000",
    break_time5_over1: "#00000000",
    break_time5_over2: "#00000000",
    break_time5_over3: "#00000000",
    break_time6: "#00000000",
    break_time6_over1: "#00000000",
    break_time6_over2: "#00000000",
    break_time6_over3: "#00000000",
    // ポップアップ1〜5とそのID（すべて空）
    pop_up1: "", pop_up_id1: "", pop_up2: "", pop_up_id2: "",
    pop_up3: "", pop_up_id3: "", pop_up4: "", pop_up_id4: "",
    pop_up5: "", pop_up_id5: "",
    break_check: false, // 休憩エラー有効チェック
    def_prediction: false, // 画面側の型定義にある項目（バックエンドのモデルからはマイグレーションで削除済み）
  },
};

// ============================================================
// テスト本体
// ============================================================

// MemberEdit 画面の表示・入力・更新送信・エラー処理をまとめて確認するテストグループ
describe("MemberEdit", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 更新完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 人員データ取得APIは常に上の mockMember を返す
    mockedApi.get.mockResolvedValue(mockMember);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 見出し「人員データ編集」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("人員データ編集")).toBeInTheDocument();
  });

  // 【テスト】表示時に URL の従業員番号を使って人員データを取得すること
  //   前提: useParams は employee_no="12345" を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/member_update/12345/" で呼ばれる
  it("loads data from API with correct endpoint", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    // 検証: 人員データ取得APIが従業員番号12345のURLで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/member_update/12345/");
    });
  });

  // 【テスト】人員データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得した氏名がフォームの入力欄に初期値として入ること
  //   前提: APIは name="テスト太郎" を返す
  //   操作: 画面を表示する
  //   期待: 値が「テスト太郎」の入力欄が存在する
  it("displays member name in form", async () => {
    // 操作: 画面を表示し、値が「テスト太郎」の入力欄を探す（表示テキストではなく value で探す）
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    const nameInput = await screen.findByDisplayValue("テスト太郎");
    // 検証: 該当する入力欄がある
    expect(nameInput).toBeInTheDocument();
  });

  // 【テスト】「更新」ボタンでフォーム内容が PUT で送信されること
  //   前提: 更新APIは成功を返す
  //   操作: 見出し表示後に入力を変えずに「更新」ボタンをクリック
  //   期待: api.put が "/api/member_update/12345/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits form data via PUT", async () => {
    // 準備: 更新APIを成功させる
    mockedApi.put.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 操作: 「更新」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 同じURLに対して何らかのオブジェクト（フォームの内容）付きで PUT が呼ばれる
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/member_update/12345/", expect.any(Object));
    });
  });

  // 【テスト】取得した従業員番号がフォームの入力欄に初期値として入ること
  //   前提: APIは employee_no=12345 を返す
  //   操作: 画面を表示する
  //   期待: 値が「12345」の入力欄が存在する
  it("displays employee number in form", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    // 検証: 従業員番号の入力欄（数値入力）の値が 12345 になっている
    expect(await screen.findByDisplayValue("12345")).toBeInTheDocument();
  });

  // 【テスト】人員一覧へ戻るリンクが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「人員一覧」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 検証: ナビゲーション欄に人員一覧画面へのリンクがある
    expect(screen.getByText("人員一覧")).toBeInTheDocument();
  });

  // 【テスト】権限の切り替えスイッチ（チェックボックス）が表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: ラベル「権限:」に紐づくチェックボックスが存在する
  it("displays authority checkbox", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 検証: label の htmlFor で紐づいたチェックボックスがラベル文字から見つかる
    expect(screen.getByLabelText("権限:")).toBeInTheDocument();
  });

  // 【テスト】権限スイッチをクリックするとOFFに切り替わること
  //   前提: 権限の初期値は true（ON）
  //   操作: 権限のチェックボックスをクリック
  //   期待: チェックが外れた状態になる
  it("handles checkbox change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 操作: 権限のチェックボックスをクリック
    const authorityCheckbox = screen.getByLabelText("権限:");
    fireEvent.click(authorityCheckbox);
    // 検証: ON → OFF に切り替わる
    expect(authorityCheckbox).not.toBeChecked();
  });

  // 【テスト】氏名の入力欄を変更すると値が反映されること
  //   前提: 氏名の初期値は「テスト太郎」
  //   操作: 氏名の入力欄に「新しい名前」を入力
  //   期待: 入力欄の値が「新しい名前」になる
  it("handles text input change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 操作: 氏名の入力欄を変更する（画面側は name 属性で更新する項目を判断するため name も渡す）
    const nameInput = screen.getByLabelText("氏名:");
    fireEvent.change(nameInput, { target: { name: "name", value: "新しい名前" } });
    // 検証: state が更新され、入力欄の値が変わる
    expect(nameInput).toHaveValue("新しい名前");
  });

  // 【テスト】人員データ取得APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】更新APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: データ取得は成功、更新APIは status 401 のエラーを返す
  //   操作: 「更新」ボタンをクリック
  //   期待: navigate("/login") が呼ばれる
  it("handles PUT error with 401", async () => {
    // 準備: 1回目の更新API呼び出しを 401 エラーにする
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 操作: 「更新」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】ショップを選ぶプルダウンが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: data-testid="shop-select" の要素（モックの ShopSelect）が存在する
  it("shows shop select component", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberEdit /></MemoryRouter>);
    await screen.findByText("人員データ編集");
    // 検証: ショップのプルダウンが data-testid で見つかる
    expect(screen.getByTestId("shop-select")).toBeInTheDocument();
  });
});
