/**
 * ============================================================
 * ファイル名 : MainMenu.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MainPage/MainMenu.tsx（メインメニュー画面）
 * 概要       : ログイン者への挨拶表示、権限（authority）・管理者（administrator）に応じた
 *              メニューボタンの表示/非表示、ログアウト処理を確認する。
 *
 * モック方針 :
 *   - img/*.png（ロゴ・各メニューのアイコン） : 画像ファイルの読み込みを、ただの文字列（"img.png"）に置き換えるため
 *   - LogConsole                   : バックエンドログを定期取得する部品を、testid 付きの簡単な div に置き換えるため
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : ログアウト後の遷移先（/login）を記録して確認するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import MainMenu from "../../MainPage/MainMenu";

// ============================================================
// モック定義
// ============================================================

// 画像のモック: ロゴと各メニューボタンのアイコン画像を、すべて "img.png" という文字列に置き換える
vi.mock("../../img/MenuRogo.png", () => ({ default: "img.png" }));
vi.mock("../../img/Note.png", () => ({ default: "img.png" }));
vi.mock("../../img/Balance.png", () => ({ default: "img.png" }));
vi.mock("../../img/Personnel.png", () => ({ default: "img.png" }));
vi.mock("../../img/Team.png", () => ({ default: "img.png" }));
vi.mock("../../img/Mail.png", () => ({ default: "img.png" }));
vi.mock("../../img/Setting.png", () => ({ default: "img.png" }));

// 子コンポーネントのモック
// LogConsole（バックエンドログ表示）: 固定文字「LogConsole」を表示するだけの div にする
vi.mock("../../Components/LogConsole", () => ({
  default: () => <div data-testid="log-console">LogConsole</div>,
}));

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
// テスト用データ
// ============================================================

// GET /api/main_menu/ のレスポンス例①: 権限あり・管理者のログイン者（テスト太郎）
//   login_data: ログイン者の人員データ。authority=true（人員・班員MENUを表示）、administrator=true（管理者MENUを表示）
//               pop_up1〜5 / pop_up_id1〜5 は本人向けお知らせ（すべて空 → お知らせなし）
//   admin_data: 管理者設定。administrator_employee_no1〜3 は問い合わせ担当者の従業員番号、
//               pop_up1〜5 / pop_up_id1〜5 は担当者向けお知らせ（すべて空 → お知らせなし）
const mockResponseAuthority = {
  data: {
    login_data: {
      employee_no: 12345,
      name: "テスト太郎",
      shop: "P",
      authority: true,
      administrator: true,
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
    admin_data: {
      administrator_employee_no1: "12345",
      administrator_employee_no2: "",
      administrator_employee_no3: "",
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
  },
};

// GET /api/main_menu/ のレスポンス例②: 権限なし・管理者でない一般のログイン者（一般ユーザー）
//   authority=false・administrator=false のため、人員・班員・管理者MENUはどれも表示されない想定
const mockResponseNoAuthority = {
  data: {
    login_data: {
      employee_no: 99999,
      name: "一般ユーザー",
      shop: "P",
      authority: false,
      administrator: false,
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
    admin_data: {
      administrator_employee_no1: "12345",
      administrator_employee_no2: "",
      administrator_employee_no3: "",
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
  },
};

// ============================================================
// テスト本体
// ============================================================

// MainMenu 画面の挨拶・権限別メニュー表示・ログアウトをまとめて確認するテストグループ
describe("MainMenu Component", () => {
  // 各テストの前に: モックの呼び出し履歴と設定を消す（APIの返り値は各テストで個別に指定する）
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】ログイン者の氏名入りの挨拶が表示されること
  //   前提: APIは氏名「テスト太郎」のログイン者データを返す
  //   操作: 画面を表示する
  //   期待: 「こんにちは テスト太郎さん」と表示される
  it("挨拶メッセージが表示されること", async () => {
    // 準備: 1回目の GET で権限あり・管理者のログイン者データを返す
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);

    // 操作: 画面を表示（Link 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に挨拶文が表示される
    expect(await screen.findByText("こんにちは テスト太郎さん")).toBeInTheDocument();
  });

  // 【テスト】権限あり（authority=true）のとき人員MENUと班員MENUのボタンが表示されること
  //   前提: APIは authority=true のログイン者データを返す
  //   操作: 画面を表示する
  //   期待: 「人員MENU」「班員MENU」という文字がある
  it("authority=trueの場合、人員MENUと班員MENUが表示されること", async () => {
    // 準備: 1回目の GET で権限ありのログイン者データを返す
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    // 検証: 読み込み完了を「人員MENU」の表示で待ち、続けて「班員MENU」も確認する
    expect(await screen.findByText("人員MENU")).toBeInTheDocument();
    expect(screen.getByText("班員MENU")).toBeInTheDocument();
  });

  // 【テスト】管理者（administrator=true）のとき管理者MENUのボタンが表示されること
  //   前提: APIは administrator=true のログイン者データを返す
  //   操作: 画面を表示する
  //   期待: 「管理者MENU」という文字がある
  it("administrator=trueの場合、管理者MENUが表示されること", async () => {
    // 準備: 1回目の GET で管理者のログイン者データを返す
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    // 検証: 管理者MENUのボタンが表示される
    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
  });

  // 【テスト】権限なし・管理者でないとき人員MENU・班員MENU・管理者MENUが表示されないこと
  //   前提: APIは authority=false・administrator=false のログイン者データを返す
  //   操作: 画面を表示する
  //   期待: 「人員MENU」「班員MENU」「管理者MENU」のどれも表示されない
  it("authority=falseの場合、人員MENUと班員MENUが非表示であること", async () => {
    // 準備: 1回目の GET で権限なしのログイン者データを返す
    mockedApi.get.mockResolvedValueOnce(mockResponseNoAuthority);

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    // 準備: 挨拶文が出るまで待ち、データ読み込みの完了を確認する
    //       （読み込み前に確認すると、まだ表示されていないだけで合格してしまうため）
    await screen.findByText("こんにちは 一般ユーザーさん");

    // 検証: 見つからなくてもエラーにならない queryByText で、3つのボタンが無いことを確認する
    expect(screen.queryByText("人員MENU")).not.toBeInTheDocument();
    expect(screen.queryByText("班員MENU")).not.toBeInTheDocument();
    expect(screen.queryByText("管理者MENU")).not.toBeInTheDocument();
  });

  // 【テスト】「ログアウト」ボタンでログアウトAPIが呼ばれ、ログイン画面へ遷移すること
  //   前提: GET はログイン者データ、ログアウトAPI（POST）は成功を返す
  //   操作: 画面表示後に「ログアウト」をクリック
  //   期待: api.post が "/api/logout/" と空オブジェクトで呼ばれ、navigate("/login") が呼ばれる
  it("ログアウトボタンでPOST /api/logout/ が呼ばれ /login へ遷移すること", async () => {
    // 準備: GET はログイン者データ、POST（ログアウト）は空のレスポンスで成功を返す
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);
    mockedApi.post.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    // 準備: 挨拶文の表示で読み込み完了を待つ
    await screen.findByText("こんにちは テスト太郎さん");

    // 操作: 「ログアウト」ボタンをクリック
    const logoutButton = screen.getByRole("button", { name: "ログアウト" });
    fireEvent.click(logoutButton);

    // 検証: POST /api/logout/ が送信データなし（{}）で呼ばれ、ログイン画面へ遷移する
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/logout/", {});
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
