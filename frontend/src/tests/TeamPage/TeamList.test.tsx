/**
 * ============================================================
 * ファイル名 : TeamList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : TeamPage/TeamList.tsx（班員工数履歴画面）
 * 概要       : 見出しの表示・一覧取得APIの呼び出し・班員の氏名と整合性（OK/NG）の表示・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useLocation : 画面遷移先の確認と URL の固定のため
 *   - Loading / TableContainer / Pagination / TeamMemberSelect : 画面の本質と関係ない子部品を単純化するため
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
// （useLocation は現在のURLを班員工数履歴画面（/team-list）に固定する。それ以外の機能は本物を使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate, useLocation: () => ({ pathname: "/team-list", state: null }) };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TableContainer: 高さ計算などを省き、中身をそのまま表示するだけにする
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
// Pagination: ページ切り替え機能は持たず、「Pagination」という文字だけを表示する
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));
// TeamMemberSelect（班員の絞り込みプルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option></select> }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import TeamList from "../../TeamPage/TeamList";

// ============================================================
// テストデータ
// ============================================================

// GET /api/team_list/ のレスポンス例（工数データ1件・全1件・1ページ20件）
const mockResponse = {
  data: {
    // 班員の工数一覧（ページネーション形式）
    pagination_data: {
      results: [
        // name は空。画面側で team_member_select を使い、従業員番号12345 → 「テスト太郎」に置き換えられる
        { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "1", judgement: true },
      ],
      page_size: 20, // 1ページあたりの件数
      count: 1, // 全件数
    },
    // 登録済みの班員一覧（氏名の置き換えと、絞り込みプルダウンの選択肢に使われる）
    team_member_select: [
      { id: 1, employee_no: 12345, name: "テスト太郎" },
    ],
  },
};

// ============================================================
// テスト本体
// ============================================================

// TeamList 画面の表示・データ取得・エラー処理をまとめて確認するテストグループ
describe("TeamList", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 見出し「班員工数履歴」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("班員工数履歴")).toBeInTheDocument();
  });

  // 【テスト】表示時に一覧取得APIが呼ばれること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/team_list/" とオプション（ページ番号などの params）付きで呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    // 検証: 一覧取得APIが何らかのオプションオブジェクト付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_list/", expect.any(Object));
    });
  });

  // 【テスト】一覧取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】一覧に班員の氏名と整合性が表示されること
  //   前提: 工数データは従業員番号12345・judgement=true、班員一覧で12345は「テスト太郎」
  //   操作: 画面を表示する
  //   期待: 「テスト太郎」と、整合性の列に「OK」が表示される
  it("displays data in table", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    // 検証: 従業員番号から置き換えた氏名が表示される
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
    // 検証: 工数入力OK判定が true なので「OK」と表示される
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});
