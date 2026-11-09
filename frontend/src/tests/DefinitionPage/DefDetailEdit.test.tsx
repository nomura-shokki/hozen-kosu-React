/**
 * ============================================================
 * ファイル名 : DefDetailEdit.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefDetailEdit.tsx（作業詳細選択肢編集画面）
 * 概要       : 見出しの表示・データ取得APIの呼び出し・取得データのフォームへの反映・
 *              「更新」ボタンでの PUT 送信・未ログイン（401）時の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :id を "1" に固定するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
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
// （useParams は URL の :id＝編集対象の作業詳細選択肢のIDを "1" に固定する。それ以外の機能は本物を使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useParams: () => ({ id: "1" }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefDetailEdit from "../../DefinitionPage/DefDetailEdit";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_detail_update/1/ のレスポンス例
const mockResponse = {
  data: {
    // 編集対象の作業詳細選択肢（定義記号「A」に対する作業詳細「作業詳細A」）
    formData: { id: 1, def_symbol: "A", def_select: "作業詳細A" },
    // 定義記号のプルダウンに並ぶ選択肢（工数区分記号の一覧）
    symbol_list: ["A", "B", "C"],
  },
};

// ============================================================
// テスト本体
// ============================================================

// DefDetailEdit 画面の表示・更新送信・エラー処理をまとめて確認するテストグループ
describe("DefDetailEdit", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 更新完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // データ取得APIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは作業詳細選択肢1件のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「作業詳細選択肢編集」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("作業詳細選択肢編集")).toBeInTheDocument();
  });

  // 【テスト】表示時に URL の :id を使って編集対象データを取得すること
  //   前提: useParams は id="1" を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_detail_update/1/" で呼ばれる
  it("loads data from API with correct endpoint", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    // 検証: データ取得APIが ID=1 のURLで呼ばれる
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
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得したデータがフォームの初期値として入力欄に入ること
  //   前提: APIは def_select="作業詳細A" のデータを返す
  //   操作: 画面を表示する
  //   期待: 値が「作業詳細A」の入力欄（作業詳細）が存在する
  it("displays form with loaded data", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    // 検証: 入力欄の値（表示テキストではなく value）が取得データと一致する
    expect(await screen.findByDisplayValue("作業詳細A")).toBeInTheDocument();
  });

  // 【テスト】「更新」ボタンでフォーム内容が PUT で送信されること
  //   前提: 更新APIは成功を返す
  //   操作: 見出し表示後に入力を変えずに「更新」ボタンをクリック
  //   期待: api.put が "/api/def_detail_update/1/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits form via PUT", async () => {
    // 準備: 更新APIを成功させる
    mockedApi.put.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><DefDetailEdit /></MemoryRouter>);
    await screen.findByText("作業詳細選択肢編集");
    // 操作: 「更新」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "更新" });
    fireEvent.click(submitBtn);
    // 検証: 同じURLに対して何らかのオブジェクト（フォームの内容）付きで PUT が呼ばれる
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/def_detail_update/1/", expect.any(Object));
    });
  });
});
