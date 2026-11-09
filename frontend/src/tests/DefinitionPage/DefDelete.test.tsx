/**
 * ============================================================
 * ファイル名 : DefDelete.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefDelete.tsx（工数区分定義削除画面）
 * 概要       : 削除対象の工数区分定義Verの表示・削除確認ダイアログでのOK/キャンセル・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :id を "1" に固定するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
 *   - window.confirm / window.alert : ブラウザのダイアログを出さず、OK/キャンセルの結果を指定するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import DefDelete from "../../DefinitionPage/DefDelete";

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
    // URL の :id（削除対象の工数区分定義VerのID）を "1" に固定する
    useParams: () => ({ id: "1" }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// ============================================================
// テスト本体
// ============================================================

// DefDelete 画面の表示・削除操作・エラー処理をまとめて確認するテストグループ
describe("DefDelete Component", () => {
  // GET /api/def_update/1/ のレスポンス例（工数区分定義Ver「Ver1」に工数区分が1件だけある）
  const mockResponse = {
    data: {
      kosu_name: "Ver1", // 工数区分定義Ver名
      kosu_title_1: "作業A", // 工数区分名1
      kosu_division_1_1: "定義A", // 工数区分1の定義
      kosu_division_2_1: "内容A", // 工数区分1の作業内容
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、ダイアログとAPIの既定の振る舞いを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 削除確認ダイアログは既定で「OK」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // 完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 定義データ取得APIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しと削除対象の定義データが表示されること
  //   前提: APIは定義Ver名「Ver1」・工数区分名「作業A」のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数区分定義削除」、「Ver1」、「作業A」が表示される
  it("工数区分定義削除の見出しと定義データが表示されること", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    // 検証: 見出しが表示されるまで待って確認する
    expect(await screen.findByText("工数区分定義削除")).toBeInTheDocument();
    // 検証: 定義Ver名が表示される
    expect(screen.getByText("Ver1")).toBeInTheDocument();
    // 検証: 工数区分名が表示される（改行ごとに span で区切って描画されるため正規表現で部分一致を確認）
    expect(screen.getByText(/作業A/)).toBeInTheDocument();
  });

  // 【テスト】削除確認でOKを押すと削除APIが呼ばれ、完了表示の後に定義メニューへ遷移すること
  //   前提: 確認ダイアログはOK、削除APIは成功を返す
  //   操作: 「削除」ボタン（画面上部と下部に2つある）のうち1つ目をクリック
  //   期待: api.delete が /api/def_delete/1/ で呼ばれ、「削除が完了しました」の表示後に /def-menu へ遷移する
  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    // 準備: 削除APIの1回目の呼び出しを成功させる
    mockedApi.delete.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    // 準備: 定義データの表示を待つ
    await screen.findByText("Ver1");
    // 操作: 「削除」ボタンは上下2か所にあるため全件取得し、1つ目をクリック
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    // 検証: 削除対象ID（1）を含むURLで削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/def_delete/1/")
      );
    });

    // 検証: 完了メッセージが表示され、工数区分定義メニュー（/def-menu）へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/def-menu");
  });

  // 【テスト】削除確認でキャンセルを押すと削除APIが呼ばれないこと
  //   前提: 確認ダイアログはキャンセル（false）を返す
  //   操作: 1つ目の「削除」ボタンをクリック
  //   期待: api.delete が一度も呼ばれない
  it("確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    // 準備: このテストだけ確認ダイアログで「キャンセル」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <DefDelete />
      </MemoryRouter>
    );

    // 準備: 定義データの表示を待つ
    await screen.findByText("Ver1");
    // 操作: 1つ目の「削除」ボタンをクリック
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    // 検証: キャンセルしたので削除APIは呼ばれない
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  // 【テスト】定義データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
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
        <DefDelete />
      </MemoryRouter>
    );

    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
