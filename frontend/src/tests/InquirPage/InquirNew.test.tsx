/**
 * ============================================================
 * ファイル名 : InquirNew.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : InquirPage/InquirNew.tsx（問い合わせ登録画面）
 * 概要       : 見出し・リンク・内容選択プルダウンの表示、問い合わせ登録の POST 送信と完了表示、
 *              表示時/送信時のエラー（401/403/500/通信以外）の挙動、内容選択の変更の反映を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / ItemSelect         : 画面の本質と関係ない子部品を単純化するため
 *   - window.alert                 : 登録完了メッセージのダイアログを出さず、呼ばれたかだけ確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import InquirNew from "../../InquirPage/InquirNew";

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
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// ItemSelect（内容の種類のプルダウン）: 選択肢「---」と「要望」の2つだけを持つ簡易版にする
// （value と onChange は本物の画面から受け取るため、選択値は画面側の state に連動する）
vi.mock("../../Components/ItemSelect", () => ({
  default: (props: any) => (
    <select data-testid="item-select" onChange={props.onChange} value={props.value}>
      <option value="">---</option>
      <option value="要望">要望</option>
    </select>
  ),
}));

// ============================================================
// テスト本体
// ============================================================

// InquirNew 画面の表示・登録送信・エラー処理をまとめて確認するテストグループ
describe("InquirNew Component", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 登録完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 表示時のログイン確認API（GET /api/inquir_new/）は成功（中身は使われないため空オブジェクト）を返す
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: ログイン確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: 見出し「問い合わせ」が表示される
  it("問い合わせの見出しが表示されること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <InquirNew />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される（完全一致なので「問い合わせMENU」等は該当しない）
    expect(await screen.findByText("問い合わせ")).toBeInTheDocument();
  });

  // 【テスト】問い合わせを入力して「登録」を押すと POST が送られ、完了メッセージが出ること
  //   前提: 登録APIは成功を返す
  //   操作: 問い合わせ欄に「テスト問い合わせ」を入力し、「登録」ボタンをクリック
  //   期待: api.post が /api/inquir_new/ を含むURLと送信データ付きで呼ばれ、「登録完了！」が表示される
  it("フォーム送信でPOSTが呼ばれアラートが表示されること", async () => {
    // 準備: 1回目の登録APIを成功させる
    mockedApi.post.mockResolvedValueOnce({ data: {} });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <InquirNew />
      </MemoryRouter>
    );

    // 準備: 読み込み完了（見出しの表示）を待つ
    await screen.findByText("問い合わせ");

    // 操作: ラベル「問い合わせ：」に紐づくテキストエリアに本文を入力
    const textarea = screen.getByLabelText("問い合わせ：");
    fireEvent.change(textarea, { target: { value: "テスト問い合わせ" } });

    // 操作: 「登録」ボタン（フォームの送信ボタン）をクリック
    const submitButton = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitButton);

    // 検証: 登録APIが入力内容（オブジェクト）付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/inquir_new/"),
        expect.any(Object)
      );
    });

    // 検証: 登録完了のメッセージが表示される
    expect(window.alert).toHaveBeenCalledWith("登録完了！");
  });

  // 【テスト】表示時のログイン確認APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("401エラー時にログインにリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】表示時のログイン確認APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("403エラー時にメインにリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】表示時のAPIがサーバーエラー（401/403 以外）を返したら、そのメッセージを表示すること
  //   前提: APIは status 500・message="サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「サーバーエラー」が表示される（フォームも表示されたまま）
  it("サーバーエラーメッセージが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    // 検証: フォーム上部のエラー表示欄にサーバーのメッセージが出る
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】問い合わせメニューへ戻るリンクが表示されること
  //   前提: ログイン確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: 「問い合わせMENU」のリンク文字が表示される
  it("ナビゲーションリンクが表示されること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    // 検証: ナビゲーション欄にメニュー画面へのリンクがある
    expect(screen.getByText("問い合わせMENU")).toBeInTheDocument();
  });

  // 【テスト】内容の種類を選ぶプルダウンが表示されること
  //   前提: ログイン確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: data-testid="item-select" の要素（モックの ItemSelect）が存在する
  it("内容選択セレクトが表示されること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    // 検証: プルダウンが data-testid で見つかる
    expect(screen.getByTestId("item-select")).toBeInTheDocument();
  });

  // 【テスト】登録APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: 表示時のAPIは成功、登録APIは status 401 のエラーを返す
  //   操作: 問い合わせ欄に「テスト」を入力して「登録」をクリック
  //   期待: navigate("/login") が呼ばれる
  it("POST送信時の401エラーでログインにリダイレクトすること", async () => {
    // 準備: 1回目の登録API呼び出しを 401 エラーにする
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    // 操作: 問い合わせ本文を入力して「登録」ボタンをクリック
    const textarea = screen.getByLabelText("問い合わせ：");
    fireEvent.change(textarea, { target: { value: "テスト" } });
    const submitButton = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitButton);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】通信以外のエラー（response を持たないエラー）では固定のエラーメッセージを表示すること
  //   前提: 表示時のAPIは通常の Error（response なし）を投げる
  //   操作: 画面を表示する
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("非Axiosエラー時にエラーメッセージが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる（isAxiosError のモックは false を返す）
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    // 操作: 画面を表示
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    // 検証: 予期しないエラー用の固定メッセージが表示される
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】内容の種類を選び直すと、プルダウンの選択値に反映されること
  //   前提: プルダウンの選択肢は「---」と「要望」
  //   操作: プルダウンで「要望」を選ぶ
  //   期待: プルダウンの値が「要望」になる（画面側の state が更新され value に戻ってくる）
  it("内容選択の変更が反映されること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirNew /></MemoryRouter>);
    await screen.findByText("問い合わせ");
    // 操作: プルダウンの値を「要望」に変更する
    const select = screen.getByTestId("item-select");
    fireEvent.change(select, { target: { value: "要望" } });
    // 検証: 選択値が「要望」になっている
    expect(select).toHaveValue("要望");
  });
});
