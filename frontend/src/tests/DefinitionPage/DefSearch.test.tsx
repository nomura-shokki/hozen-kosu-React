/**
 * ============================================================
 * ファイル名 : DefSearch.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefSearch.tsx（工数区分定義確認画面）
 * 概要       : 使用中の工数区分定義Verの取得・工数区分プルダウンの表示・
 *              工数区分選択時の定義/作業内容の表示と解除・エラー時の表示や遷移・0件時の表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
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
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefSearch from "../../DefinitionPage/DefSearch";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_search/ のレスポンス例（使用中の工数区分定義Ver 1件。工数区分は1番目の「作業A」だけ）
const mockResponse = {
  data: [
    // kosu_title_1: 工数区分名 / kosu_division_1_1: 定義 / kosu_division_2_1: 作業内容
    { id: 1, kosu_title_1: "作業A", kosu_division_1_1: "定義A", kosu_division_2_1: "内容A" },
  ],
};

// ============================================================
// テスト本体
// ============================================================

// DefSearch 画面の表示・工数区分の選択・エラー処理をまとめて確認するテストグループ
describe("DefSearch", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは工数区分「作業A」を含む定義データを返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数区分定義確認」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数区分定義確認")).toBeInTheDocument();
  });

  // 【テスト】表示時に使用中の工数区分定義Verのデータを取得すること
  //   前提: APIは定義データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_search/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    // 検証: 定義データ取得APIがパラメータなしで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_search/");
    });
  });

  // 【テスト】定義データ取得APIが401（未ログイン・定義Ver未選択）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】工数区分が未選択の間は、定義・作業内容の欄に代わりの文言が表示されること
  //   前提: APIは定義データを返す（プルダウンは未選択のまま）
  //   操作: 画面を表示する
  //   期待: 「該当する定義がありません」「該当する作業内容がありません」が表示される
  it("displays default definition text", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    // 検証: 定義欄の代わりの文言（読み込み完了を待って確認）
    expect(await screen.findByText("該当する定義がありません")).toBeInTheDocument();
    // 検証: 作業内容欄の代わりの文言
    expect(screen.getByText("該当する作業内容がありません")).toBeInTheDocument();
  });

  // 【テスト】工数区分定義メニューへ戻るリンクが表示されること
  //   前提: APIは定義データを返す
  //   操作: 画面を表示する
  //   期待: 「工数区分定義MENU」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    // 検証: ナビゲーション欄にメニュー画面へのリンクがある
    expect(screen.getByText("工数区分定義MENU")).toBeInTheDocument();
  });

  // 【テスト】工数区分を選ぶプルダウンが表示されること
  //   前提: APIは定義データを返す
  //   操作: 画面を表示する
  //   期待: ラベル「定義確認する工数区分選択:」に紐づく入力部品（プルダウン）が存在する
  it("displays select dropdown", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    // 検証: label の htmlFor で紐づいたプルダウンがラベル文字から見つかる
    expect(screen.getByLabelText("定義確認する工数区分選択:")).toBeInTheDocument();
  });

  // 【テスト】取得した工数区分名がプルダウンの選択肢として並ぶこと
  //   前提: APIは工数区分名「作業A」を含む定義データを返す
  //   操作: 画面を表示する
  //   期待: 選択肢「作業A」が表示される
  it("displays options from division data", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    // 検証: 工数区分名が選択肢（option）として存在する
    expect(screen.getByText("作業A")).toBeInTheDocument();
  });

  // 【テスト】工数区分を選ぶと、その定義と作業内容が表示されること
  //   前提: 工数区分「作業A」の定義は「定義A」、作業内容は「内容A」
  //   操作: プルダウンで「作業A」を選ぶ
  //   期待: 「定義A」と「内容A」が表示される
  it("selects a division and shows definition", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    // 操作: プルダウンの値を「作業A」に変更する
    const select = screen.getByLabelText("定義確認する工数区分選択:");
    fireEvent.change(select, { target: { value: "作業A" } });
    // 検証: 同じ番号（1番目）の定義と作業内容が表示される
    expect(screen.getByText("定義A")).toBeInTheDocument();
    expect(screen.getByText("内容A")).toBeInTheDocument();
  });

  // 【テスト】「選択してください」（空の選択肢）に戻すと、定義の表示が初期の文言に戻ること
  //   前提: 工数区分「作業A」が選べる
  //   操作: 「作業A」を選んだ後、空の選択肢に戻す
  //   期待: 「該当する定義がありません」が表示される
  it("resets definition when selecting empty option", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    // 操作: 「作業A」を選んでから、未選択（空文字）に戻す
    const select = screen.getByLabelText("定義確認する工数区分選択:");
    fireEvent.change(select, { target: { value: "作業A" } });
    fireEvent.change(select, { target: { value: "" } });
    // 検証: 定義欄が空になり、代わりの文言が表示される
    expect(screen.getByText("該当する定義がありません")).toBeInTheDocument();
  });

  // 【テスト】サーバーエラー（401/403 以外）のときはサーバーのメッセージを表示すること
  //   前提: APIは status 500・message="サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「Error: サーバーエラー」が表示される
  it("displays server error message", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    // 検証: 画面全体がエラー表示（"Error: " + メッセージ）に置き換わる
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】通信以外のエラー（response を持たないエラー）では固定のエラーメッセージを表示すること
  //   前提: APIは通常の Error（response なし）を投げる
  //   操作: 画面を表示する
  //   期待: 「Error: 不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays non-axios error", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる（isAxiosError のモックは false を返す）
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    // 操作: 画面を表示
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    // 検証: 予期しないエラー用の固定メッセージが表示される
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】定義データが0件のとき、プルダウンに「データが存在しません」が表示されること
  //   前提: APIは空配列を返す
  //   操作: 画面を表示する
  //   期待: 選択できない選択肢「データが存在しません」が表示される
  it("handles empty divisions array", async () => {
    // 準備: 1回目のAPI呼び出しで空配列を返す
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefSearch /></MemoryRouter>);
    await screen.findByText("工数区分定義確認");
    // 検証: 0件時の選択肢が表示される
    expect(screen.getByText("データが存在しません")).toBeInTheDocument();
  });
});
