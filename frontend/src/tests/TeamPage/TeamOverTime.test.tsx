/**
 * ============================================================
 * ファイル名 : TeamOverTime.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : TeamPage/TeamOverTime.tsx（班員残業画面）
 * 概要       : 見出しの表示・表示月の班員工数データ取得APIの呼び出し・班員名と合計列の表示・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
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
import { render, screen, waitFor } from "@testing-library/react";
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
import TeamOverTime from "../../TeamPage/TeamOverTime";

// ============================================================
// テストデータ
// ============================================================

// GET /api/team_overtime/ のレスポンス例（工数データなし・班員1人・表示月は2025年1月）
const mockResponse = {
  data: {
    kosu_data: [], // 表示月の班員の工数データ（ここでは0件）
    member_name_list: [[12345, "テスト太郎"]], // 班員の [従業員番号, 氏名] の一覧
    session_year: 2025, // セッションに保存された表示年
    session_month: 1, // セッションに保存された表示月
  },
};

// ============================================================
// テスト本体
// ============================================================

// TeamOverTime 画面の表示・データ取得・エラー処理をまとめて確認するテストグループ
describe("TeamOverTime", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは班員1人・工数データ0件を返す
  //   操作: 画面を表示する
  //   期待: 見出し「班員工数入力状況」が表示される（この画面の見出し文字は班員工数入力状況画面と同じ）
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("班員工数入力状況")).toBeInTheDocument();
  });

  // 【テスト】表示時に表示月の班員工数データを取得すること
  //   前提: APIは班員1人・工数データ0件を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/team_overtime/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    // 検証: データ取得APIがパラメータなしで呼ばれる（表示年月はサーバー側のセッションで管理される）
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_overtime/");
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
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】班員の氏名と、月合計の列の見出しが表示されること
  //   前提: 班員一覧に「テスト太郎」がいる
  //   操作: 画面を表示する
  //   期待: 「テスト太郎」と見出し「合計」が表示される
  it("displays member names and total column", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamOverTime /></MemoryRouter>);
    // 検証: 表の左端（氏名のセル）に班員名が表示される
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
    // 検証: 表の右端に月合計の列見出しがある
    expect(screen.getByText("合計")).toBeInTheDocument();
  });
});
