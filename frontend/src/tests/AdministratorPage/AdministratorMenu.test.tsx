/**
 * ============================================================
 * ファイル名 : AdministratorMenu.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorMenu.tsx（管理者メニュー画面）
 * 概要       : 管理者権限の確認が成功したときのメニュー表示と、
 *              401（未ログイン）/ 403（権限なし）のときの画面遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import AdministratorMenu from "../../AdministratorPage/AdministratorMenu";

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

// AdministratorMenu 画面のメニュー表示と権限エラー時の遷移を確認するテストグループ
describe("AdministratorMenu Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定をリセットする
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】管理者権限の確認が成功すると、見出しと各管理画面へのリンクが表示されること
  //   前提: 管理者メニューAPI（GET /api/manager_menu/）は成功する
  //   操作: 画面を表示する
  //   期待: 「管理者MENU」の見出しと、設定変更・データ管理・全工数データ管理・
  //         非同期タスクデータ管理・データ操作履歴管理の各リンクが表示される
  it("管理者MENUの見出しとリンクが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しを成功（空データ）にする
    mockedApi.get.mockResolvedValueOnce({ data: {} });

    // 操作: 画面を表示（Link や useNavigate を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <AdministratorMenu />
      </MemoryRouter>
    );

    // 検証: 権限確認が終わり見出しが出るまで待ってから、各リンクの文字を確認する
    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
    expect(screen.getByText("設定変更")).toBeInTheDocument();
    expect(screen.getByText("データ管理")).toBeInTheDocument();
    expect(screen.getByText("全工数データ管理")).toBeInTheDocument();
    expect(screen.getByText("非同期タスクデータ管理")).toBeInTheDocument();
    expect(screen.getByText("データ操作履歴管理")).toBeInTheDocument();
  });

  // 【テスト】APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: 管理者メニューAPIは status 401 のエラーを返す
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
        <AdministratorMenu />
      </MemoryRouter>
    );

    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】APIが403（管理者権限なし）を返したらメインメニューへ遷移すること
  //   前提: 管理者メニューAPIは status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("403エラー時に/へリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403 },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <AdministratorMenu />
      </MemoryRouter>
    );

    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
