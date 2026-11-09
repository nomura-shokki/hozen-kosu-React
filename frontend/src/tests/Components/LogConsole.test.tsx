/**
 * ============================================================
 * ファイル名 : LogConsole.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/LogConsole.tsx（サーバーのログ内容を表示するログ表示欄部品）
 * 概要       : ログ取得中は「Loading log...」、取得成功時はログ本文、
 *              取得失敗時はエラーメッセージが表示されることを確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）                  : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - styles/Components/LogConsole.module.css : CSS Modules のクラス名を固定の文字列にして単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import LogConsole from "../../Components/LogConsole";

// ============================================================
// モック定義
// ============================================================

// api（共通axiosインスタンス）のモック: この部品が使う get だけを「何もしない偽の関数」にする
vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));
import api from "../../api/axios";
// モック関数のメソッド（mockResolvedValue など）を型エラーなしで呼ぶため any として扱う
const mockedApi = api as any;

// CSS Modules のモック: styles.クラス名 が同じ文字列をそのまま返すようにする
vi.mock("../../styles/Components/LogConsole.module.css", () => ({
  default: {
    consoleContainer: "consoleContainer",
    loading: "loading",
    error: "error",
    consoleOutput: "consoleOutput",
  },
}));

// ============================================================
// テスト本体
// ============================================================

// LogConsole 部品の取得中・成功・失敗の各表示を確認するテストグループ
describe("LogConsole Component", () => {
  // 各テストの前に: モックの呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】ログ取得が終わるまでは「Loading log...」が表示されること
  //   前提: ログ取得API（GET /api/web_console_log/）はいつまでも応答しない
  //   操作: 部品を表示する
  //   期待: 「Loading log...」が表示される
  it("初期表示時に 'Loading log...' が表示されること", () => {
    // 準備: いつまでも完了しない Promise を返し、取得中のままにする
    mockedApi.get.mockReturnValue(new Promise(() => {})); // 永遠に完了しない（resolve されない）
    // 操作: 部品を表示
    render(<LogConsole />);
    // 検証: 取得中の表示が出ている
    expect(screen.getByText("Loading log...")).toBeInTheDocument();
  });

  // 【テスト】ログ取得に成功すると、ログ本文が表示されること
  //   前提: ログ取得APIは log_content に "test log content" を返す
  //   操作: 部品を表示する
  //   期待: 「test log content」が表示される
  it("データ取得後にログ内容が表示されること", async () => {
    // 準備: ログ取得APIが本文を返すようにする
    mockedApi.get.mockResolvedValue({ data: { log_content: "test log content" } });
    // 操作: 部品を表示
    render(<LogConsole />);
    // 検証: 取得が終わり、ログ本文が表示されるまで待って確認する
    await waitFor(() => {
      expect(screen.getByText("test log content")).toBeInTheDocument();
    });
  });

  // 【テスト】ログ取得に失敗すると、エラーメッセージが表示されること
  //   前提: ログ取得APIは例外（Network Error）を投げる
  //   操作: 部品を表示する
  //   期待: 「ログの読み込みに失敗しました。」が表示される
  it("データ取得失敗時にエラーメッセージが表示されること", async () => {
    // 準備: ログ取得APIを失敗させる
    mockedApi.get.mockRejectedValue(new Error("Network Error"));
    // 操作: 部品を表示
    render(<LogConsole />);
    // 検証: エラーメッセージが表示されるまで待って確認する
    await waitFor(() => {
      expect(screen.getByText("ログの読み込みに失敗しました。")).toBeInTheDocument();
    });
  });
});
