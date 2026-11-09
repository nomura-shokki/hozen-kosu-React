/**
 * ============================================================
 * ファイル名 : KosuMenu.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuMenu.tsx（工数メニュー画面）
 * 概要       : 見出しと各画面へのメニューリンクの表示、ログイン確認APIが401を返したときの遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先（/login）を記録して確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import KosuMenu from "../../KosuPage/KosuMenu";

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
  return { ...actual, useNavigate: () => mockedNavigate };
});

// ============================================================
// テスト本体
// ============================================================

// KosuMenu 画面の表示とログイン確認時のエラー処理をまとめて確認するテストグループ
describe("KosuMenu Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返り値は各テストで個別に指定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】画面見出し「工数MENU」が表示されること
  //   前提: ログイン確認APIは人員データ（従業員番号1・太郎）を返す
  //   操作: 画面を表示する
  //   期待: 「工数MENU」という見出しがある
  it("工数MENUの見出しが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しで人員データを返す（画面はレスポンスの中身を使わない）
    mockedApi.get.mockResolvedValueOnce({ data: { employee_no: 1, name: "太郎" } });

    // 操作: 画面を表示（Link 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <KosuMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数MENU")).toBeInTheDocument();
  });

  // 【テスト】工数関連の5画面へのメニューリンクがすべて表示されること
  //   前提: ログイン確認APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「工数入力」「工数履歴」「休憩変更」「勤務入力」「工数集計」のリンク文字がある
  it("メニューリンクが正しく表示されること", async () => {
    // 準備: 1回目のAPI呼び出しで人員データを返す
    mockedApi.get.mockResolvedValueOnce({ data: { employee_no: 1, name: "太郎" } });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <KosuMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了を「工数入力」の表示で待ち、続けて残り4つのリンクも確認する
    expect(await screen.findByText("工数入力")).toBeInTheDocument();
    expect(screen.getByText("工数履歴")).toBeInTheDocument();
    expect(screen.getByText("休憩変更")).toBeInTheDocument();
    expect(screen.getByText("勤務入力")).toBeInTheDocument();
    expect(screen.getByText("工数集計")).toBeInTheDocument();
  });

  // 【テスト】ログイン確認APIが401（未ログイン）を返したらログイン画面へ遷移すること
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
        <KosuMenu />
      </MemoryRouter>
    );

    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
