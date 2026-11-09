/**
 * ============================================================
 * ファイル名 : MemberDelete.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : MemberPage/MemberDelete.tsx（人員削除画面）
 * 概要       : 削除対象の人員データの表示・削除確認ダイアログでのOK/キャンセル・
 *              未ログイン（401）時のログイン画面への遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :employee_no を "12345" に固定するため
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
import MemberDelete from "../../MemberPage/MemberDelete";

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
    // URL の :employee_no（削除対象の人員の従業員番号）を "12345" に固定する
    useParams: () => ({ employee_no: "12345" }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// ============================================================
// テスト本体
// ============================================================

// MemberDelete 画面の表示・削除操作・エラー処理をまとめて確認するテストグループ
describe("MemberDelete Component", () => {
  // GET /api/member_update/12345/ のレスポンス例（削除対象の人員データ）
  const mockMember = {
    data: {
      employee_no: 12345, // 従業員番号
      name: "太郎", // 氏名
      shop: "P", // ショップ
      authority: true, // 権限あり
      administrator: false, // 管理者ではない
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、ダイアログとAPIの既定の振る舞いを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 削除確認ダイアログは既定で「OK」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // 完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 人員データ取得APIは常に上の mockMember を返す
    mockedApi.get.mockResolvedValue(mockMember);
  });

  // 【テスト】削除対象の人員データが表に表示されること
  //   前提: APIは従業員番号12345・氏名「太郎」・ショップ「P」の人員データを返す
  //   操作: 画面を表示する
  //   期待: 「太郎」「12345」「P」が表示される
  it("人員データがテーブルに表示されること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に氏名が表示される
    expect(await screen.findByText("太郎")).toBeInTheDocument();
    // 検証: 従業員番号とショップも表示される
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  // 【テスト】削除確認でOKを押すと削除APIが呼ばれ、完了表示の後に人員一覧へ遷移すること
  //   前提: 確認ダイアログはOK、削除APIは成功を返す
  //   操作: 「削除」ボタンをクリック
  //   期待: api.delete が /api/member_delete/12345/ で呼ばれ、「削除が完了しました」の表示後に /member-list へ遷移する
  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    // 準備: 1回目の削除APIを成功させる
    mockedApi.delete.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    // 準備: 人員データの表示を待つ
    await screen.findByText("太郎");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: 削除対象の従業員番号（12345）を含むURLで削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/member_delete/12345/")
      );
    });

    // 検証: 完了メッセージが表示され、人員一覧（/member-list）へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/member-list");
  });

  // 【テスト】削除確認でキャンセルを押すと削除APIが呼ばれないこと
  //   前提: 確認ダイアログはキャンセル（false）を返す
  //   操作: 「削除」ボタンをクリック
  //   期待: api.delete が一度も呼ばれない
  it("確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    // 準備: このテストだけ確認ダイアログで「キャンセル」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <MemberDelete />
      </MemoryRouter>
    );

    // 準備: 人員データの表示を待つ
    await screen.findByText("太郎");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: キャンセルしたので削除APIは呼ばれない
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  // 【テスト】人員データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
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
        <MemberDelete />
      </MemoryRouter>
    );

    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
