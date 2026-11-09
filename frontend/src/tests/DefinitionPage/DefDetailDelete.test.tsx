/**
 * ============================================================
 * ファイル名 : DefDetailDelete.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefDetailDelete.tsx（作業詳細選択肢削除画面）
 * 概要       : 見出しと削除対象データの表示・データ取得APIの呼び出し・
 *              削除ボタンでの削除と遷移・未ログイン（401）時の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :id を "1" に固定するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
 *   - window.alert                 : 完了メッセージのダイアログを出さず、呼ばれたかだけ確認するため
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
// （useParams は URL の :id＝削除対象の作業詳細選択肢のIDを "1" に固定する。それ以外の機能は本物を使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefDetailDelete from "../../DefinitionPage/DefDetailDelete";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_detail_update/1/ のレスポンス例
const mockResponse = {
  data: {
    // 削除対象の作業詳細選択肢（定義記号「A」に対する作業詳細「作業詳細A」）
    formData: { id: 1, def_symbol: "A", def_select: "作業詳細A" },
    // 選択可能な定義記号（工数区分記号）の一覧（削除画面では表示に使われない）
    symbol_list: ["A", "B", "C"],
  },
};

// ============================================================
// テスト本体
// ============================================================

// DefDetailDelete 画面の表示・削除操作・エラー処理をまとめて確認するテストグループ
describe("DefDetailDelete", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // データ取得APIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは作業詳細選択肢1件のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「作業詳細選択肢削除」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("作業詳細選択肢削除")).toBeInTheDocument();
  });

  // 【テスト】表示時に URL の :id を使って削除対象データを取得すること
  //   前提: useParams は id="1" を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_detail_update/1/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    // 検証: 編集画面と共通のデータ取得APIが ID=1 で呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_detail_update/1/");
    });
  });

  // 【テスト】データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】削除対象の作業詳細が画面に表示されること
  //   前提: APIは def_select="作業詳細A" のデータを返す
  //   操作: 画面を表示する
  //   期待: 「作業詳細A」が表示される
  it("displays record data", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    // 検証: 作業詳細の欄にデータが表示される
    expect(await screen.findByText("作業詳細A")).toBeInTheDocument();
  });

  // 【テスト】「削除」ボタンで削除APIが呼ばれ、完了表示の後に作業詳細一覧へ遷移すること
  //   前提: 削除APIは成功を返す（この画面には確認ダイアログがない）
  //   操作: データ表示後に「削除」ボタンをクリック
  //   期待: api.delete が "/api/def_detail_delete/1/" で呼ばれ、
  //         「削除が完了しました」の表示後に /def-detail-list へ遷移する
  it("deletes record on button click", async () => {
    // 準備: 削除APIを成功させる
    mockedApi.delete.mockResolvedValue({});
    // 準備: 画面を表示し、データの表示を待つ
    render(<MemoryRouter><DefDetailDelete /></MemoryRouter>);
    await screen.findByText("作業詳細A");
    // 操作: 「削除」ボタンをクリック
    const deleteBtn = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteBtn);
    // 検証: 削除対象ID（1）のURLで削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith("/api/def_detail_delete/1/");
    });
    // 検証: 完了メッセージが表示され、作業詳細選択肢一覧（/def-detail-list）へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/def-detail-list");
  });
});
