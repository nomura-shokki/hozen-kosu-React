/**
 * ============================================================
 * ファイル名 : Help.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MainPage/Help.tsx（ヘルプ画面 / データ初期化画面）
 * 概要       : 初期表示の認証画面、パスワード認証の成功/失敗、認証後のデータリセット
 *              （リセット対象の未選択エラー・確認ダイアログのOK/キャンセル・認証時のパスワードの送信・
 *              パスワード違い（403）時のエラー表示）を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : リセット完了後の遷移先（/login）を記録して確認するため
 *   - window.confirm / window.alert : ブラウザのダイアログを出さずに「OK/キャンセル」を再現するため（各テスト内で設定）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import Help from "../../MainPage/Help";

// ============================================================
// モック定義
// ============================================================

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

// Help 画面のパスワード認証とデータリセット処理をまとめて確認するテストグループ
describe("Help Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返り値は各テストで個別に指定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】初期表示では認証画面が表示され、ヘルプ（初期化フォーム）は表示されないこと
  //   前提: まだパスワード認証をしていない
  //   操作: 画面を表示する
  //   期待: 見出し「認証」があり、「ヘルプ」という文字はない
  it("初期表示で認証画面が表示されること", () => {
    // 操作: 画面を表示（Link 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 検証: 見出し（heading）「認証」がある（同名の「認証」ボタンと区別するため role で指定する）
    expect(screen.getByRole("heading", { name: "認証" })).toBeInTheDocument();
    // 検証: 認証前なので「ヘルプ」の見出しは無い（見つからなくてもエラーにならない queryByText を使う）
    expect(screen.queryByText("ヘルプ")).not.toBeInTheDocument();
  });

  // 【テスト】パスワード認証に成功するとヘルプ画面（初期化フォーム）に切り替わること
  //   前提: 認証API（POST）は { result: true }（認証成功）を返す
  //   操作: パスワード欄に "secret" を入力し、「認証」をクリック
  //   期待: 見出し「ヘルプ」が表示される
  it("パスワード認証成功後にヘルプ画面が表示されること", async () => {
    // 準備: 1回目の POST（パスワード認証）で認証成功を返す
    mockedApi.post.mockResolvedValueOnce({
      data: { result: true },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 操作: プレースホルダー（入力欄の薄い案内文字）でパスワード欄を探し、値を入力する
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });

    // 操作: 「認証」ボタンをクリック
    const authButton = screen.getByRole("button", { name: "認証" });
    fireEvent.click(authButton);

    // 検証: 認証後の画面の見出し「ヘルプ」が表示される
    expect(await screen.findByText("ヘルプ")).toBeInTheDocument();
  });

  // 【テスト】パスワード認証に失敗するとエラーメッセージが表示されること
  //   前提: 認証API（POST）は { result: false }（認証失敗）を返す
  //   操作: パスワード欄に "wrong" を入力し、「認証」をクリック
  //   期待: エラー欄（role="alert"）に「認証に失敗しました。」が表示される
  it("パスワード認証失敗時にエラーメッセージが表示されること", async () => {
    // 準備: 1回目の POST（パスワード認証）で認証失敗を返す
    mockedApi.post.mockResolvedValueOnce({
      data: { result: false },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 操作: 誤ったパスワードを入力
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "wrong" } });

    // 操作: 「認証」ボタンをクリック
    const authButton = screen.getByRole("button", { name: "認証" });
    fireEvent.click(authButton);

    // 検証: エラー欄に認証失敗のメッセージが表示される
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "認証に失敗しました。"
    );
  });

  // 【テスト】認証後に「人員データリセット」を選んで書き込むと、確認ダイアログの後にリセットAPIが呼ばれ、
  //          完了メッセージを出してログイン画面へ遷移すること
  //   前提: 認証APIは成功、リセットAPIも成功を返す。確認ダイアログは「OK」
  //   操作: 認証 → 「人員データリセット」スイッチをON → 「書き込み」をクリック
  //   期待: confirm が呼ばれ、api.post が "/api/help/" と memberReset: true・認証時のパスワード
  //         （password: "secret"）を含むデータで呼ばれる。
  //         alert に従業員番号「12345」を含むメッセージが出て、navigate("/login") が呼ばれる
  //   ※サーバー側はリセット時にもパスワードを確認するため、認証時のパスワードを一緒に送る必要がある
  it("認証後、memberチェックボックスを選択してリセット実行すると確認ダイアログが表示されAPIが呼ばれること", async () => {
    // 準備: 1回目の POST（パスワード認証）で認証成功を返す
    mockedApi.post.mockResolvedValueOnce({
      data: { result: true },
    });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 準備: パスワードを入力して認証し、初期化フォームに切り替える
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));

    // 準備: 見出し「ヘルプ」が出るまで待つ（認証完了）
    await screen.findByText("ヘルプ");

    // 準備: 2回目の POST（リセットAPI）は空のレスポンスで成功を返す
    mockedApi.post.mockResolvedValueOnce({});

    // 準備: 確認ダイアログは1回だけ「OK」（true）を返し、alert は何もしないようにする
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});

    // 操作: 「人員データリセット」のスイッチ（チェックボックス）をONにする
    //       ラベル文字は「人員データリセット:」なので正規表現で部分一致検索する
    const memberCheckbox = screen.getByRole("checkbox", { name: /人員データリセット/ });
    fireEvent.click(memberCheckbox);

    // 操作: 「書き込み」ボタンをクリック
    const submitButton = screen.getByRole("button", { name: "書き込み" });
    fireEvent.click(submitButton);

    // 検証: 確認ダイアログが出て、リセットAPIが memberReset: true と認証時のパスワードを含むデータで呼ばれる
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/api/help/",
        expect.objectContaining({ memberReset: true, password: "secret" })
      );
    });

    // 検証: 「従業員番号：12345でログイン可能です」を含む完了メッセージが出て、ログイン画面へ遷移する
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("12345")
      );
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】リセット対象を1つも選ばずに書き込むとエラーメッセージが表示されること
  //   前提: 認証APIは成功を返す
  //   操作: 認証 → スイッチを何もONにせず「書き込み」をクリック
  //   期待: エラー欄（role="alert"）に「リセットするデータを選択してください。」が表示される
  it("チェックボックス未選択で書き込みするとエラーメッセージが表示されること", async () => {
    // 準備: 1回目の POST（パスワード認証）で認証成功を返す
    mockedApi.post.mockResolvedValueOnce({ data: { result: true } });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 準備: パスワードを入力して認証する
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));

    // 準備: 見出し「ヘルプ」が出るまで待つ（認証完了）
    await screen.findByText("ヘルプ");

    // 操作: 何も選ばずに「書き込み」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "書き込み" }));

    // 検証: 未選択エラーのメッセージが表示される
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "リセットするデータを選択してください。"
    );
  });

  // 【テスト】確認ダイアログでキャンセルしたときはリセットAPIが呼ばれないこと
  //   前提: 認証APIは成功を返す。確認ダイアログは「キャンセル」
  //   操作: 認証 → 「人員データリセット」スイッチをON → 「書き込み」をクリック
  //   期待: 書き込みクリック後に api.post が一度も呼ばれない
  it("確認ダイアログでキャンセルした場合にAPIが呼ばれないこと", async () => {
    // 準備: 1回目の POST（パスワード認証）で認証成功を返す
    mockedApi.post.mockResolvedValueOnce({ data: { result: true } });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 準備: パスワードを入力して認証する
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));

    // 準備: 見出し「ヘルプ」が出るまで待つ（認証完了）
    await screen.findByText("ヘルプ");

    // 準備: 確認ダイアログは1回だけ「キャンセル」（false）を返す
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);

    // 準備: 「人員データリセット」のスイッチをONにする（未選択エラーで止まらないようにするため）
    const memberCheckbox = screen.getByRole("checkbox", { name: /人員データリセット/ });
    fireEvent.click(memberCheckbox);

    // 準備: 認証時の POST 呼び出し履歴を消し、書き込み時の呼び出しだけを確認できるようにする
    mockedApi.post.mockClear();
    // 操作: 「書き込み」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "書き込み" }));

    // 検証: キャンセルしたのでリセットAPIは呼ばれていない
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  // 【テスト】リセットAPIがパスワード違い（403）を返したら、サーバーのメッセージを表示し、画面遷移しないこと
  //   前提: 認証APIは成功を返す。リセットAPIは status 403・「パスワードが正しくありません。」を返す。確認ダイアログは「OK」
  //   操作: 認証 → 「人員データリセット」スイッチをON → 「書き込み」をクリック
  //   期待: エラー欄（role="alert"）に「パスワードが正しくありません。」が表示され、
  //         完了メッセージ（alert）は出ず、ログイン画面へも遷移しない
  it("リセットAPIが403を返した場合にサーバーのエラーメッセージが表示されること", async () => {
    // 準備: 1回目の POST（パスワード認証）で認証成功を返す
    mockedApi.post.mockResolvedValueOnce({ data: { result: true } });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // 準備: パスワードを入力して認証し、見出し「ヘルプ」が出るまで待つ
    const passwordInput = screen.getByPlaceholderText("パスワードを入力してください");
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "認証" }));
    await screen.findByText("ヘルプ");

    // 準備: 2回目の POST（リセットAPI）はパスワード違いの 403 エラーを返す
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 403, data: { status: "error", message: "パスワードが正しくありません。" } },
    });
    // 準備: 確認ダイアログは1回だけ「OK」を返し、alert は呼ばれたかどうかだけ記録する
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    // 操作: 「人員データリセット」のスイッチをONにして「書き込み」をクリック
    fireEvent.click(screen.getByRole("checkbox", { name: /人員データリセット/ }));
    fireEvent.click(screen.getByRole("button", { name: "書き込み" }));

    // 検証: サーバーのエラーメッセージが表示され、完了メッセージも画面遷移もない
    expect(await screen.findByRole("alert")).toHaveTextContent("パスワードが正しくありません。");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockedNavigate).not.toHaveBeenCalled();
  });
});
