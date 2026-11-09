/**
 * ============================================================
 * ファイル名 : Login.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MainPage/Login.tsx（ログイン画面）
 * 概要       : 見出しと従業員番号入力欄の表示、ログイン成功時の遷移、ログイン失敗時のメッセージ表示、
 *              通信エラー（401 / それ以外）時の動作を確認する。
 *
 * モック方針 :
 *   - img/TitleRogo.png            : 画像ファイルの読み込みを、ただの文字列（"logo.png"）に置き換えるため
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/ や /login）を記録して確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import Login from "../../MainPage/Login";

// ============================================================
// モック定義
// ============================================================

// ロゴ画像のモック: 画像ファイルの代わりに "logo.png" という文字列を返す
vi.mock("../../img/TitleRogo.png", () => ({ default: "logo.png" }));

// api（共通axiosインスタンス）のモック: get/post/put/delete をすべて「何もしない偽の関数」に置き換える
vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
import api from "../../api/axios";
// モック関数のメソッド（mockResolvedValue など）を型エラーなしで呼ぶため any として扱う
const mockedApi = api as any;

// axios.isAxiosError のモック: response プロパティを持つエラーなら true（通信エラー扱い）を返す
vi.mock("axios", () => ({
  default: {
    isAxiosError: vi.fn((err) => !!err.response),
  },
}));

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  // Link や MemoryRouter など、それ以外の機能は本物をそのまま使う
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// ============================================================
// テスト本体
// ============================================================

// Login 画面の表示とログイン処理（成功・失敗・通信エラー）をまとめて確認するテストグループ
describe("Login Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返り値は各テストで個別に指定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】見出し「ログイン」と従業員番号の入力欄が表示されること
  //   前提: なし（表示時にAPIは呼ばれない）
  //   操作: 画面を表示する
  //   期待: 見出し（heading）「ログイン」と、ラベル「従業員番号」の入力欄がある
  it("ログイン見出しと従業員番号入力欄が表示されること", () => {
    // 操作: 画面を表示（Link 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // 検証: 同名の「ログイン」ボタンと区別するため role="heading" で見出しを探す
    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    // 検証: ラベル文字「従業員番号」に対応する入力欄がある
    expect(screen.getByLabelText("従業員番号")).toBeInTheDocument();
  });

  // 【テスト】ログインに成功するとメインメニュー（/）へ遷移すること
  //   前提: ログインAPI（POST）は { status: "success" } を返す
  //   操作: 従業員番号に 12345 を入力し、「ログイン」をクリック
  //   期待: navigate("/") が呼ばれる
  it("ログイン成功時に / へ遷移すること", async () => {
    // 準備: 1回目の POST でログイン成功を返す
    mockedApi.post.mockResolvedValueOnce({
      data: { status: "success" },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // 操作: 従業員番号を入力
    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "12345" } });

    // 操作: 「ログイン」ボタンをクリック
    const button = screen.getByRole("button", { name: "ログイン" });
    fireEvent.click(button);

    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】ログインに失敗するとサーバーからのメッセージが表示されること
  //   前提: ログインAPI（POST）は status "error"・message "従業員が見つかりません" を返す（通信自体は成功）
  //   操作: 従業員番号に 99999 を入力し、「ログイン」をクリック
  //   期待: エラー欄（role="alert"）に「従業員が見つかりません」が表示される
  it("ログイン失敗時にエラーメッセージが表示されること", async () => {
    // 準備: 1回目の POST でログイン失敗の結果を返す
    mockedApi.post.mockResolvedValueOnce({
      data: { status: "error", message: "従業員が見つかりません" },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // 操作: 登録されていない想定の従業員番号を入力
    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "99999" } });

    // 操作: 「ログイン」ボタンをクリック
    const button = screen.getByRole("button", { name: "ログイン" });
    fireEvent.click(button);

    // 検証: レスポンスの message がエラー欄に表示される
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "従業員が見つかりません"
    );
  });

  // 【テスト】ログインAPIが401を返したらログイン画面（/login）へ遷移すること
  //   前提: ログインAPI（POST）は status 401 のエラーを返す
  //   操作: 従業員番号に 12345 を入力し、「ログイン」をクリック
  //   期待: navigate("/login") が呼ばれる
  it("401エラー時に /login へ遷移すること", async () => {
    // 準備: 1回目の POST を 401 エラーにする
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 401 },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // 操作: 従業員番号を入力
    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "12345" } });

    // 操作: 「ログイン」ボタンをクリック
    const button = screen.getByRole("button", { name: "ログイン" });
    fireEvent.click(button);

    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】401以外の通信エラーではサーバーからのメッセージが表示されること
  //   前提: ログインAPI（POST）は status 500・message "サーバーエラー" のエラーを返す
  //   操作: 従業員番号に 12345 を入力し、「ログイン」をクリック
  //   期待: エラー欄（role="alert"）に「サーバーエラー」が表示される
  it("401以外のAPIエラー時にレスポンスのエラーメッセージが表示されること", async () => {
    // 準備: 1回目の POST を 500 エラーにする
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // 操作: 従業員番号を入力し、「ログイン」ボタンをクリック
    const input = screen.getByLabelText("従業員番号");
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    // 検証: レスポンスの message がエラー欄に表示される
    expect(await screen.findByRole("alert")).toHaveTextContent("サーバーエラー");
  });
});
