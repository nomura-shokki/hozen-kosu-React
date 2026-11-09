/**
 * ============================================================
 * ファイル名 : AdministratorTaskDetail.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorTaskDetail.tsx（非同期タスク詳細画面）
 * 概要       : 非同期タスク（バックアップ/復元などのバックグラウンド処理）1件分の詳細表示と、
 *              削除ボタン押下時の確認OK / キャンセルそれぞれの動きを確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL のタスクID（id="1"）の固定のため
 *   - Loading                      : 画面の本質と関係ない子部品を単純化するため
 *   - window.confirm / window.alert : ブラウザの確認・通知ダイアログを出さずに自動で応答させるため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import TaskDetail from "../../AdministratorPage/AdministratorTaskDetail";

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

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  // Link や MemoryRouter など、それ以外の機能は本物をそのまま使う
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    // URLパラメータのタスクIDを "1" に固定する（/manager-task-detail/1 を開いた状態を再現）
    useParams: () => ({ id: "1" }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// ============================================================
// テスト本体
// ============================================================

// AdministratorTaskDetail 画面の表示と削除処理を確認するテストグループ
describe("AdministratorTaskDetail Component", () => {
  // 非同期タスク詳細APIのレスポンス例（タスクID "abc-123"・状態 success・結果「完了」）
  const mockResponse = {
    data: {
      task_data: {
        id: 1,
        task_id: "abc-123",
        status: "success",
        result: "完了",
        created_at: "2023-10-25",
        updated_at: "2023-10-25",
      },
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、確認ダイアログは常に「OK」、
  // 通知ダイアログは何もしない設定にし、APIは常に上記のタスクデータを返すようにする
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】初期表示で非同期タスクの各項目と見出しが表示されること
  //   前提: APIはタスクID "abc-123"・状態 success・結果「完了」のタスクを返す
  //   操作: 画面を表示する
  //   期待: 各値と「タスクID」「状態」「結果」の見出しが表示される
  it("タスク詳細が表示されること", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <TaskDetail />
      </MemoryRouter>
    );

    // 検証: タスクIDが表示されるまで待ってから、他の値と見出しを確認する
    expect(await screen.findByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("完了")).toBeInTheDocument();
    expect(screen.getByText("タスクID")).toBeInTheDocument();
    expect(screen.getByText("状態")).toBeInTheDocument();
    expect(screen.getByText("結果")).toBeInTheDocument();
  });

  // 【テスト】「削除」ボタン押下 → 確認OKで削除APIが呼ばれ、完了通知後に一覧画面へ戻ること
  //   前提: 確認ダイアログは「OK」を返す（beforeEach）、削除APIは成功する
  //   操作: 初期表示後に「削除」ボタンをクリック
  //   期待: DELETE /api/manager_task_detail/1/ が呼ばれ、alert("削除が完了しました") の後に
  //         navigate("/manager-task")（非同期タスク一覧画面）が呼ばれる
  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    // 準備: 削除APIを成功（空のレスポンス）にする
    mockedApi.delete.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <TaskDetail />
      </MemoryRouter>
    );

    // 準備: 初期表示のデータ取得が終わるのを待つ
    await screen.findByText("abc-123");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: URLのタスクID（1）を含む削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/manager_task_detail/1/")
      );
    });

    // 検証: 削除完了の通知が出て、非同期タスク一覧画面へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/manager-task");
  });

  // 【テスト】確認ダイアログで「キャンセル」したら削除APIが呼ばれないこと
  //   前提: 確認ダイアログは「キャンセル」（false）を返す
  //   操作: 初期表示後に「削除」ボタンをクリック
  //   期待: api.delete が一度も呼ばれない
  it("確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    // 準備: このテストだけ確認ダイアログの戻り値を false（キャンセル）にする
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <TaskDetail />
      </MemoryRouter>
    );

    // 準備: 初期表示のデータ取得が終わるのを待つ
    await screen.findByText("abc-123");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: 削除APIは呼ばれない
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });
});
