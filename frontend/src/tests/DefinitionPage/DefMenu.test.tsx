/**
 * ============================================================
 * ファイル名 : DefMenu.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefMenu.tsx（工数区分定義メニュー画面）
 * 概要       : 見出しの表示と、ログイン者が管理者かどうかによる
 *              管理用ボタン（工数区分定義登録・一覧、作業詳細選択肢登録・一覧）の表示/非表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を記録するため（このファイルでは遷移の検証はしていない）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import DefMenu from "../../DefinitionPage/DefMenu";

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

// DefMenu 画面の見出しと、管理者かどうかによるボタンの出し分けを確認するテストグループ
describe("DefMenu Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返す値は各テストで個別に設定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは管理者（administrator: true）のログイン者データを返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数区分定義MENU」が表示される
  it("工数区分定義MENUの見出しが表示されること", async () => {
    // 準備: 1回目のAPI（GET /api/def_menu/）で管理者の人員データを返す
    mockedApi.get.mockResolvedValueOnce({
      data: { employee_no: 1, name: "太郎", shop: "P", authority: true, administrator: true },
    });

    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <DefMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数区分定義MENU")).toBeInTheDocument();
  });

  // 【テスト】ログイン者が管理者の場合、管理用の4つのボタンが表示されること
  //   前提: APIは administrator: true の人員データを返す
  //   操作: 画面を表示する
  //   期待: 「工数区分定義登録」「工数区分定義一覧」「作業詳細選択肢登録」「作業詳細選択肢一覧」が表示される
  it("管理者の場合に管理者専用リンクが表示されること", async () => {
    // 準備: 1回目のAPIで管理者の人員データを返す
    mockedApi.get.mockResolvedValueOnce({
      data: { employee_no: 1, name: "太郎", shop: "P", authority: true, administrator: true },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <DefMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に管理用ボタンがすべて表示される
    expect(await screen.findByText("工数区分定義登録")).toBeInTheDocument();
    expect(screen.getByText("工数区分定義一覧")).toBeInTheDocument();
    expect(screen.getByText("作業詳細選択肢登録")).toBeInTheDocument();
    expect(screen.getByText("作業詳細選択肢一覧")).toBeInTheDocument();
  });

  // 【テスト】ログイン者が管理者でない場合、管理用ボタンが表示されないこと
  //   前提: APIは administrator: false の人員データを返す（authority は true）
  //   操作: 画面を表示する
  //   期待: 全員向けの「工数区分定義確認」は表示され、「工数区分定義登録」「工数区分定義一覧」は表示されない
  it("管理者でない場合に管理者専用リンクが非表示であること", async () => {
    // 準備: 1回目のAPIで管理者ではない人員データを返す
    mockedApi.get.mockResolvedValueOnce({
      data: { employee_no: 1, name: "太郎", shop: "P", authority: true, administrator: false },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <DefMenu />
      </MemoryRouter>
    );

    // 検証: 全員に表示されるボタンが出るまで待つ（＝読み込み完了）
    expect(await screen.findByText("工数区分定義確認")).toBeInTheDocument();
    // 検証: 管理用ボタンは存在しない（queryBy は見つからないと null を返すため非表示の確認に使う）
    expect(screen.queryByText("工数区分定義登録")).not.toBeInTheDocument();
    expect(screen.queryByText("工数区分定義一覧")).not.toBeInTheDocument();
  });
});
