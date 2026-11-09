/**
 * ============================================================
 * ファイル名 : MemberNew.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MemberPage/MemberNew.tsx（人員登録画面）
 * 概要       : 表示時の利用可否確認API・入力欄と権限スイッチの表示と変更・
 *              「登録」ボタンでの POST 送信・エラー時（401/403/500/通信以外）の挙動を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / ShopSelect         : 画面の本質と関係ない子部品を単純化するため
 *   - window.alert                 : 登録完了メッセージのダイアログを出さないため
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
// ShopSelect（ショップのプルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import MemberNew from "../../MemberPage/MemberNew";

// ============================================================
// テスト本体
// ============================================================

// MemberNew 画面の表示・入力・登録送信・エラー処理をまとめて確認するテストグループ
describe("MemberNew", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 登録完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 表示時の利用可否確認APIは成功（中身は使われないため空オブジェクト）を返す
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: 利用可否確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: 見出し「人員登録」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("人員登録")).toBeInTheDocument();
  });

  // 【テスト】表示時に利用可否確認用のAPIが呼ばれること
  //   前提: 利用可否確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/member_new/" で呼ばれる
  it("loads auth check from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    // 検証: 利用可否確認APIがパラメータなしで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/member_new/");
    });
  });

  // 【テスト】利用可否確認APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】利用可否確認APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】「登録」ボタンでフォーム内容が POST で送信されること
  //   前提: 登録APIは成功を返す
  //   操作: 見出し表示後に入力せずに「登録」ボタンをクリック
  //   期待: api.post が "/api/member_new/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits form data via POST", async () => {
    // 準備: 登録APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 操作: 「登録」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    // 検証: 何らかのオブジェクト（フォームの入力内容）付きで POST が呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/member_new/", expect.any(Object));
    });
  });

  // 【テスト】人員メニューへ戻るリンクが表示されること
  //   前提: 利用可否確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: 「人員MENU」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 検証: ナビゲーション欄にメニュー画面へのリンクがある
    expect(screen.getByText("人員MENU")).toBeInTheDocument();
  });

  // 【テスト】登録フォームの各入力欄が表示されること
  //   前提: 利用可否確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: ラベル「従業員番号:」「氏名:」「権限:」「管理者権限:」に紐づく入力部品がある
  it("displays form fields", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 検証: label の htmlFor で紐づいた入力部品がラベル文字から見つかる
    expect(screen.getByLabelText("従業員番号:")).toBeInTheDocument();
    expect(screen.getByLabelText("氏名:")).toBeInTheDocument();
    expect(screen.getByLabelText("権限:")).toBeInTheDocument();
    expect(screen.getByLabelText("管理者権限:")).toBeInTheDocument();
  });

  // 【テスト】氏名の入力欄を変更すると値が反映されること
  //   前提: 氏名の初期値は空
  //   操作: 氏名の入力欄に「テスト」を入力
  //   期待: 入力欄の値が「テスト」になる
  it("handles text input change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 操作: 氏名の入力欄を変更する（画面側は name 属性で更新する項目を判断するため name も渡す）
    const nameInput = screen.getByLabelText("氏名:");
    fireEvent.change(nameInput, { target: { name: "name", value: "テスト" } });
    // 検証: state が更新され、入力欄の値が変わる
    expect(nameInput).toHaveValue("テスト");
  });

  // 【テスト】権限スイッチをクリックするとONに切り替わること
  //   前提: 権限の初期値は false（OFF）
  //   操作: 権限のチェックボックスをクリック
  //   期待: チェックが入った状態になる
  it("handles checkbox change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 操作: 権限のチェックボックスをクリック
    const authorityCheckbox = screen.getByLabelText("権限:");
    fireEvent.click(authorityCheckbox);
    // 検証: OFF → ON に切り替わる
    expect(authorityCheckbox).toBeChecked();
  });

  // 【テスト】登録APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: 表示時のAPIは成功、登録APIは status 401 のエラーを返す
  //   操作: 「登録」ボタンをクリック
  //   期待: navigate("/login") が呼ばれる
  it("handles POST error with 401", async () => {
    // 準備: 1回目の登録API呼び出しを 401 エラーにする
    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 操作: 「登録」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】登録APIがエラーを返したら、サーバーからのメッセージを画面に表示すること
  //   前提: 登録APIは status 500・message="サーバーエラー" のエラーを返す
  //   操作: 「登録」ボタンをクリック
  //   期待: 「サーバーエラー」が表示される
  it("handles POST error with server message", async () => {
    // 準備: 1回目の登録API呼び出しを 500 エラーにする
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 操作: 「登録」ボタンをクリック
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    // 検証: 401/403 以外のエラーなので、サーバーのメッセージがフォーム上部に表示される
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】ショップを選ぶプルダウンが表示されること
  //   前提: 利用可否確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: data-testid="shop-select" の要素（モックの ShopSelect）が存在する
  it("shows shop select component", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    await screen.findByText("人員登録");
    // 検証: ショップのプルダウンが data-testid で見つかる
    expect(screen.getByTestId("shop-select")).toBeInTheDocument();
  });

  // 【テスト】通信以外のエラー（response を持たないエラー）では固定のエラーメッセージを表示すること
  //   前提: 利用可否確認APIは通常の Error（response なし）を投げる
  //   操作: 画面を表示する
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays error for non-axios error on auth", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる（isAxiosError のモックは false を返す）
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    // 操作: 画面を表示
    render(<MemoryRouter><MemberNew /></MemoryRouter>);
    // 検証: 予期しないエラー用の固定メッセージが表示される
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });
});
