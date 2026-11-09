/**
 * ============================================================
 * ファイル名 : AdministratorTaskList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorTaskList.tsx（非同期タスクデータ管理画面）
 * 概要       : 非同期タスク（バックアップ/復元などのバックグラウンド処理）一覧の表示と、
 *              作成日時が "YYYY-MM-DD (HH:MM)" 形式に整形されて表示されることを確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移の関数を偽物に差し替えるため
 *   - Loading / TableContainer / Pagination : 画面の本質と関係ない子部品を単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import AdministratorTaskList from "../../AdministratorPage/AdministratorTaskList";

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

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録できるようにする
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TableContainer: 高さ計算などを省き、中身をそのまま表示するだけにする
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
// Pagination: ボタンを持たず「Pagination」という文字を出すだけのダミーにする（このファイルではページ切り替えを試さない）
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));

// ============================================================
// テスト本体
// ============================================================

// AdministratorTaskList 画面の一覧表示を確認するテストグループ
describe("AdministratorTaskList Component", () => {
  // 非同期タスク一覧APIのレスポンス例（タスク1件・全1件・1ページ20件）
  const mockResponse = {
    data: {
      task_data: {
        results: [
          {
            id: 1,
            task_id: "abc-123",
            status: "success",
            result: "",
            // タイムゾーン指定（末尾の Z など）が無いため、実行環境の現地時刻 10:30 として解釈される
            created_at: "2023-10-25T10:30:00",
            updated_at: "2023-10-25T10:35:00",
          },
        ],
        count: 1,
        page_size: 20,
      },
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上記のタスクデータを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】取得したタスクデータが一覧表に表示されること
  //   前提: APIはタスクID "abc-123"・状態 success のタスク1件を返す
  //   操作: 画面を表示する
  //   期待: 「abc-123」と「success」が表示される
  it("テーブルにタスクデータが表示されること", async () => {
    // 操作: 画面を表示（Link や useNavigate を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <AdministratorTaskList />
      </MemoryRouter>
    );

    // 検証: タスクIDが表示されるまで待ってから、状態の表示も確認する
    expect(await screen.findByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });

  // 【テスト】作成日時が "YYYY-MM-DD (HH:MM)" 形式に整形されて表示されること
  //   前提: APIは created_at "2023-10-25T10:30:00" のタスクを返す
  //   操作: 画面を表示する
  //   期待: 「2023-10-25 (10:30)」が表示される
  it("タイムスタンプがフォーマットされて表示されること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <AdministratorTaskList />
      </MemoryRouter>
    );

    // 検証: 整形後の日時文字列が表示されるまで待って確認する
    expect(await screen.findByText("2023-10-25 (10:30)")).toBeInTheDocument();
  });
});
