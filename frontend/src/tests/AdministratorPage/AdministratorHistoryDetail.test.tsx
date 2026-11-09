/**
 * ============================================================
 * ファイル名 : AdministratorHistoryDetail.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorHistoryDetail.tsx（データ操作履歴詳細画面）
 * 概要       : 操作履歴（データ変更の監査ログ）1件分の詳細表示・変更内容の整形表示・
 *              削除処理・変更内容が空のときの「変更なし」表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の履歴ID（id="1"）の固定のため
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
import HistoryDetail from "../../AdministratorPage/AdministratorHistoryDetail";

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
    // URLパラメータの履歴IDを "1" に固定する（/manager-history-detail/1 を開いた状態を再現）
    useParams: () => ({ id: "1" }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// ============================================================
// テスト本体
// ============================================================

// AdministratorHistoryDetail 画面の表示・変更内容の整形・削除処理をまとめて確認するテストグループ
describe("AdministratorHistoryDetail Component", () => {
  // 履歴詳細APIのレスポンス例（member テーブルの name を「太郎」→「次郎」に更新した操作履歴）
  const mockResponse = {
    data: {
      history_data: {
        id: 1,
        operation: "UPDATE",
        table_name: "member",
        record_id: "101",
        login_No: "12345",
        // 変更内容はサーバー側で Python の辞書形式（シングルクォート）の文字列として保存されている
        changes: "{'name': {'old': '太郎', 'new': '次郎'}}",
        timestamp: "2023-10-25 10:30:00",
      },
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、確認ダイアログは常に「OK」、
  // 通知ダイアログは何もしない設定にし、APIは常に上記の履歴データを返すようにする
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】初期表示で履歴詳細の各項目と見出しが表示されること
  //   前提: APIは UPDATE / member / レコードID 101 / 従業員番号 12345 の履歴を返す
  //   操作: 画面を表示する
  //   期待: 画面タイトル、各項目の値、「操作種類」「テーブル名」の見出しが表示される
  it("履歴詳細が表示されること", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    // 検証: データ取得が終わり画面タイトルが出るまで待ってから、各項目の値と見出しを確認する
    expect(await screen.findByText("データ操作履歴詳細")).toBeInTheDocument();
    expect(screen.getByText("UPDATE")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("操作種類")).toBeInTheDocument();
    expect(screen.getByText("テーブル名")).toBeInTheDocument();
  });

  // 【テスト】変更内容（Python辞書形式の文字列）が項目名と old/new の値に整形して表示されること
  //   前提: 変更内容は "{'name': {'old': '太郎', 'new': '次郎'}}"
  //   操作: 画面を表示する
  //   期待: 項目名「name」と、変更前「太郎」・変更後「次郎」の文字が表示される
  it("変更内容がold/newフォーマットで表示されること", async () => {
    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    // 準備: データ取得が終わり画面タイトルが出るまで待つ
    await screen.findByText("データ操作履歴詳細");
    // 検証: 項目名は単独の要素、old/new の値は他の文字と同じ行に並ぶため正規表現（部分一致）で確認する
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText(/太郎/)).toBeInTheDocument();
    expect(screen.getByText(/次郎/)).toBeInTheDocument();
  });

  // 【テスト】「削除」ボタン押下 → 確認OKで削除APIが呼ばれ、完了通知後に一覧画面へ戻ること
  //   前提: 確認ダイアログは「OK」を返す（beforeEach）、削除APIは成功する
  //   操作: 初期表示後に「削除」ボタンをクリック
  //   期待: DELETE /api/manager_history_detail/1/ が呼ばれ、alert("削除しました") の後に
  //         navigate("/manager-history")（データ操作履歴一覧画面）が呼ばれる
  it("削除ボタンクリックで確認OK時にDELETEが呼ばれること", async () => {
    // 準備: 削除APIを成功（空のレスポンス）にする
    mockedApi.delete.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    // 準備: 初期表示のデータ取得が終わるのを待つ
    await screen.findByText("データ操作履歴詳細");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: URLの履歴ID（1）を含む削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/manager_history_detail/1/")
      );
    });

    // 検証: 削除完了の通知が出て、データ操作履歴一覧画面へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/manager-history");
  });

  // 【テスト】変更内容が空文字の履歴では「変更なし」と表示されること
  //   前提: APIは changes が "" の CREATE 履歴を返す
  //   操作: 画面を表示する
  //   期待: 編集内容欄に「変更なし」が表示される
  it("空の変更内容の場合に変更なしが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しだけ、変更内容が空の履歴データを返すようにする
    mockedApi.get.mockResolvedValueOnce({
      data: {
        history_data: {
          id: 2,
          operation: "CREATE",
          table_name: "member",
          record_id: "102",
          login_No: "12345",
          changes: "",
          timestamp: "2023-10-25 11:00:00",
        },
      },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <HistoryDetail />
      </MemoryRouter>
    );

    // 検証: 「変更なし」が表示されるまで待って確認する
    expect(await screen.findByText("変更なし")).toBeInTheDocument();
  });
});
