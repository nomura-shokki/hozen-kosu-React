/**
 * ============================================================
 * ファイル名 : DefVer.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefVer.tsx（工数区分定義切り替え画面）
 * 概要       : 見出しの表示・Ver一覧取得APIの呼び出し・現在使用中のVer名の表示・
 *              切り替えボタンでの POST 送信・未ログイン（401）時の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / DefVersionSelect   : 画面の本質と関係ない子部品を単純化するため
 *   - window.alert                 : 切り替え完了メッセージのダイアログを出さないため
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
// DefVersionSelect（工数区分定義Verのプルダウン）: 選択肢「---」だけを持つ簡易版にし、onChange だけ本物の画面から受け取る
vi.mock("../../Components/DefVersionSelect", () => ({ default: (props: any) => <select data-testid="version-select" onChange={props.onChange}><option value="">---</option></select> }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefVer from "../../DefinitionPage/DefVer";

// ============================================================
// テストデータ
// ============================================================

// GET /api/def_ver/ のレスポンス例
const mockResponse = {
  data: {
    choices: [{ id: 1, kosu_name: "Ver1" }], // 登録済みの工数区分定義Ver一覧
    current_version: "Ver1", // セッションに保存されている現在使用中のVer名
  },
};

// ============================================================
// テスト本体
// ============================================================

// DefVer 画面の表示・切り替え送信・エラー処理をまとめて確認するテストグループ
describe("DefVer", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 切り替え完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // Ver一覧取得APIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIはVer一覧と現在のVerを返す
  //   操作: 画面を表示する
  //   期待: 見出し（heading）「工数区分定義切り替え」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    // 検証: 同じ文字のボタンもあるため、役割（heading）を指定して見出しを探す
    expect(await screen.findByRole("heading", { name: "工数区分定義切り替え" })).toBeInTheDocument();
  });

  // 【テスト】表示時にVer一覧と現在のVerを取得すること
  //   前提: APIはVer一覧と現在のVerを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_ver/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    // 検証: Ver一覧取得APIがパラメータなしで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_ver/");
    });
  });

  // 【テスト】Ver一覧取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】現在使用中のVer名が表示されること
  //   前提: APIは current_version="Ver1" を返す
  //   操作: 画面を表示する
  //   期待: 「Ver1」を含む文字（現在の工数区分のVerは "Ver1" です）が表示される
  it("displays current version", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    // 検証: 説明文の一部に Ver 名が含まれる（文中の一部なので正規表現で部分一致を確認）
    expect(await screen.findByText(/Ver1/)).toBeInTheDocument();
  });

  // 【テスト】切り替えボタンで選択中のVerが POST で送信されること
  //   前提: 切り替えAPIは成功を返す
  //   操作: 見出し表示後に「工数区分定義切り替え」ボタンをクリック
  //   期待: api.post が "/api/def_ver/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits version change via POST", async () => {
    // 準備: 切り替えAPIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    await screen.findByRole("heading", { name: "工数区分定義切り替え" });
    // 操作: 見出しと同じ文字のボタン（役割 button）をクリックしてフォームを送信
    const submitBtn = screen.getByRole("button", { name: "工数区分定義切り替え" });
    fireEvent.click(submitBtn);
    // 検証: 何らかのオブジェクト（選択したVer名 versionchoice）付きで POST が呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_ver/", expect.any(Object));
    });
  });
});
