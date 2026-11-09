/**
 * ============================================================
 * ファイル名 : TeamNew.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : TeamPage/TeamNew.tsx（班員登録画面）
 * 概要       : 見出しの表示・班員登録用データ取得APIの呼び出し・「登録」ボタンでの POST 送信・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / TeamMemberSelect / ShopSelect : 画面の本質と関係ない子部品を単純化するため
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
// TeamMemberSelect（メンバー1〜15の人員選択プルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option></select> }));
// ShopSelect（ショップ絞り込みプルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import TeamNew from "../../TeamPage/TeamNew";

// ============================================================
// テストデータ
// ============================================================

// GET /api/team_new/ のレスポンス例
const mockResponse = {
  data: {
    // メンバー選択プルダウンの選択肢にする人員一覧
    member_select: [
      { employee_no: 1, name: "山田", shop: "W1" },
      { employee_no: 2, name: "佐藤", shop: "W2" },
    ],
    // ログイン者の人員データ（W1 は組長以上のショップではないため、ショップ絞り込み欄は表示されない）
    member_data: { employee_no: 1, shop: "W1" },
    // 登録済み班員の一覧（メンバー1 に従業員番号1が入る）
    member_default: [{ employee_no: 1 }],
    // ログイン者の班員データ（フォローOFF）
    team_data: { follow: false },
  },
};

// ============================================================
// テスト本体
// ============================================================

// TeamNew 画面の表示・登録送信・エラー処理をまとめて確認するテストグループ
describe("TeamNew", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは班員登録用データを返す
  //   操作: 画面を表示する
  //   期待: 見出し「班員登録」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される（完全一致なので「班員MENU」は該当しない）
    expect(await screen.findByText("班員登録")).toBeInTheDocument();
  });

  // 【テスト】表示時に班員登録用データを取得すること
  //   前提: APIは班員登録用データを返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/team_new/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    // 検証: 班員登録用データ取得APIがパラメータなしで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_new/");
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
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】「登録」ボタンでフォーム内容が POST で送信されること
  //   前提: 保存APIは成功を返す
  //   操作: 見出し表示後に入力を変えずに「登録」ボタンをクリック
  //   期待: api.post が "/api/team_new/" と送信データ（オブジェクト）付きで呼ばれる
  it("submits form via POST", async () => {
    // 準備: 保存APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    await screen.findByText("班員登録");
    // 操作: 「登録」ボタン（フォームの送信ボタン）をクリック
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    // 検証: 何らかのオブジェクト（メンバー1〜15・フォロー設定などのフォーム内容）付きで POST が呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_new/", expect.any(Object));
    });
  });
});
