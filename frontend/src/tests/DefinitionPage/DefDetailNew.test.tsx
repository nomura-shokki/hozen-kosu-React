/**
 * ============================================================
 * ファイル名 : DefDetailNew.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefDetailNew.tsx（作業詳細選択肢登録画面）
 * 概要       : 見出しの表示・初期表示時のAPI呼び出し・「登録」ボタンでの POST 送信・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
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

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefDetailNew from "../../DefinitionPage/DefDetailNew";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_detail_new/ のレスポンス例（選択中の工数区分定義Verの内容）
// 工数区分が2件あるため、定義記号のプルダウンは A・B と「$」の3つになる
const mockResponse = {
  data: {
    kosu_title_1: "作業A", // 工数区分名1（記号 A に対応）
    kosu_title_2: "作業B", // 工数区分名2（記号 B に対応）
  },
};

// ============================================================
// テスト本体
// ============================================================

// DefDetailNew 画面の表示・登録送信・エラー処理をまとめて確認するテストグループ
describe("DefDetailNew", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 登録完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 初期表示時のAPIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは工数区分2件の定義データを返す
  //   操作: 画面を表示する
  //   期待: 見出し「作業詳細選択肢登録」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("作業詳細選択肢登録")).toBeInTheDocument();
  });

  // 【テスト】表示時に定義記号の選択肢作成用のデータを取得すること
  //   前提: APIは工数区分2件の定義データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_detail_new/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    // 検証: 初期表示用のAPIがパラメータなしで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_new/");
    });
  });

  // 【テスト】初期表示APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】「登録」ボタンでフォーム内容が POST で送信されること
  //   前提: 登録APIは成功を返す
  //   操作: 見出し表示後に入力せずに「登録」ボタンをクリック
  //   期待: api.post が "/api/def_detail_new/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits form via POST", async () => {
    // 準備: 登録APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><DefDetailNew /></MemoryRouter>);
    await screen.findByText("作業詳細選択肢登録");
    // 操作: 「登録」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    // 検証: 何らかのオブジェクト（定義記号・作業詳細の入力内容）付きで POST が呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_detail_new/", expect.any(Object));
    });
  });
});
