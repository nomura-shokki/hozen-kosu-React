/**
 * ============================================================
 * ファイル名 : AdministratorUpdate.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorUpdate.tsx（管理者設定編集画面）
 * 概要       : 管理者設定（一覧表示項目数・問い合わせ担当者の従業員番号）の初期表示・
 *              401（未ログイン）時の遷移・「編集」ボタンでの保存（PUT）を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading                      : 画面の本質と関係ない子部品を単純化するため
 *   - LogConsole                   : バックエンドログを定期取得する部品のため、通信させず文字を出すだけにする
 *   - window.alert                 : ブラウザの通知ダイアログを出さないため
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
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// LogConsole（バックエンドログ表示）: 通信をせず「LogConsole」という文字を出すだけにする
vi.mock("../../Components/LogConsole", () => ({ default: () => <div data-testid="log-console">LogConsole</div> }));

// テスト対象のコンポーネント
// （vi.mock はファイル先頭へ自動的に巻き上げられるため、ここで読み込んでもモックが適用される）
import AdminUpdate from "../../AdministratorPage/AdministratorUpdate";

// ============================================================
// テスト用データ
// ============================================================

// 管理者設定取得APIのレスポンス例（一覧表示項目数20・問い合わせ担当者1のみ 11111 を設定）
const mockResponse = {
  data: {
    admin_data: {
      menu_row: 20,
      administrator_employee_no1: 11111,
      // 担当者2・3は未設定（null）。画面では空欄で表示される
      administrator_employee_no2: null,
      administrator_employee_no3: null,
    },
    // ログイン者の人員データ（この画面では表示に使われない）
    login_data: { employee_no: 11111, name: "管理者", shop: "W1", authority: true, administrator: true },
  },
};

// ============================================================
// テスト本体
// ============================================================

// AdministratorUpdate 画面の表示・保存・エラー時の遷移を確認するテストグループ
describe("AdministratorUpdate", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、通知ダイアログは何もしない設定にし、
  // ログ表示ON/OFFの保存先（localStorage）を空にして、APIは常に上記の設定データを返すようにする
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    localStorage.clear();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面タイトルが表示されること
  //   前提: APIは管理者設定を返す
  //   操作: 画面を表示する
  //   期待: 「設定編集」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    // 検証: データ取得が終わり画面タイトルが出るまで待って確認する
    expect(await screen.findByText("設定編集")).toBeInTheDocument();
  });

  // 【テスト】初期表示で管理者設定取得APIが呼ばれること
  //   前提: APIは管理者設定を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/manager_update/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    // 検証: 管理者設定取得APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_update/");
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
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得した管理者設定がフォームの入力欄に入った状態で表示されること
  //   前提: APIは 一覧表示項目数 20・問い合わせ担当者1 11111 を返す
  //   操作: 画面を表示する
  //   期待: 値が "20" の入力欄と、値が "11111" の入力欄がある
  it("displays form with loaded data", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    // 検証: 一覧表示項目数の欄が表示されるまで待ってから、担当者1の欄も確認する
    expect(await screen.findByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("11111")).toBeInTheDocument();
  });

  // 【テスト】「編集」ボタンで入力チェックを通過し、管理者設定更新APIが呼ばれること
  //   前提: 取得した設定は入力チェックを通る内容（一覧表示項目数20、担当者は11111のみ）、更新APIは成功する
  //   操作: 初期表示後に「編集」ボタンをクリック
  //   期待: api.put が "/api/manager_update/" と送信データ（フォームの内容）付きで呼ばれる
  it("submits form via PUT", async () => {
    // 準備: 更新APIを成功（空のデータ）にする
    mockedApi.put.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    await screen.findByText("設定編集");
    // 操作: 「編集」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "編集" });
    fireEvent.click(submitBtn);
    // 検証: 管理者設定更新APIが送信データ付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/manager_update/", expect.any(Object));
    });
  });
});
