/**
 * ============================================================
 * ファイル名 : InquirMenu.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : InquirPage/InquirMenu.tsx（問い合わせメニュー画面）
 * 概要       : 見出しと各画面（問い合わせ・問い合わせ履歴）へのボタンの表示、
 *              未ログイン（401）時のログイン画面への遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   （Loading はモックせず本物を使う）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import InquirMenu from "../../InquirPage/InquirMenu";

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
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// ============================================================
// テスト本体
// ============================================================

// InquirMenu 画面の表示とエラー処理を確認するテストグループ
describe("InquirMenu Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返す値は各テストで個別に設定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】見出しと各画面へのボタンが表示されること
  //   前提: ログイン確認用のAPI（GET /api/inquir_menu/）は成功を返す
  //   操作: 画面を表示する
  //   期待: 見出し「問い合わせMENU」と「問い合わせ」「問い合わせ履歴」のボタンが表示される
  it("問い合わせMENUの見出しとリンクが表示されること", async () => {
    // 準備: 1回目のAPIを成功させる（画面はレスポンスの中身を使わないため空オブジェクト）
    mockedApi.get.mockResolvedValueOnce({ data: {} });

    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <InquirMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("問い合わせMENU")).toBeInTheDocument();
    // 検証: 問い合わせ登録画面・問い合わせ履歴画面へのボタンが表示される
    expect(screen.getByText("問い合わせ")).toBeInTheDocument();
    expect(screen.getByText("問い合わせ履歴")).toBeInTheDocument();
  });

  // 【テスト】ログイン確認用のAPIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("401エラー時に/loginへリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirMenu />
      </MemoryRouter>
    );

    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
