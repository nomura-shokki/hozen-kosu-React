/**
 * ============================================================
 * ファイル名 : KosuDelete.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : KosuPage/KosuDelete.tsx（工数データ削除画面）
 * 概要       : 削除対象の工数データの初期表示・削除ボタン押下時の確認ダイアログと削除API呼び出し・
 *              キャンセル時の動作・401時の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - KosuBarChart / KosuDisplay / DefTable / Loading : グラフ描画など画面の本質と関係ない子部品を
 *                                    testid 付きの簡単な div に置き換え、表示されたかだけを確認するため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の工数ID（123）の固定のため
 *   - window.confirm / window.alert : ブラウザのダイアログを出さずに「OK/キャンセル」を再現するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import KosuDelete from "../../KosuPage/KosuDelete";

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
    isAxiosError: vi.fn((err: any) => !!err.response),
  },
}));

// 子コンポーネントのモック（testid 付きの簡単な div に置き換え、表示されたかだけを確認できるようにする）
// KosuBarChart（工数の棒グラフ）: 固定文字「Chart Mock」を表示する
vi.mock("../../Components/KosuBarChart", () => ({
  default: () => <div data-testid="mock-bar-chart">Chart Mock</div>
}));
// KosuDisplay（工数の時刻別表示）: 受け取ったショップ名（props.shop）だけを表示し、正しく渡されたか確認できるようにする
vi.mock("../../Components/KosuDisplay", () => ({
  default: (props: any) => <div data-testid="mock-display">{props.shop}</div>
}));
// DefTable（工数区分定義の一覧表）: 固定文字「Table Mock」を表示する
vi.mock("../../Components/DefTable", () => ({
  default: () => <div data-testid="mock-def-table">Table Mock</div>
}));
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({
  default: () => null
}));

// react-router-dom のモック
// useNavigate: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  // Link や MemoryRouter など、それ以外の機能は本物をそのまま使う
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    // URL の :id（削除対象の工数データID）を "123" に固定する
    useParams: () => ({ id: "123" }),
  };
});


// ============================================================
// テスト用データ
// ============================================================

// 工数データ取得APIのレスポンス例（削除対象の工数データ1件・工数区分定義・ログイン者のショップ）
const mockResponseData = {
  data: {
    kosu_data: {
      id: "123",
      work_day2: "2023-10-25",
      tyoku2: "1",
      time_work: "08:00-17:00",
      detail_work: "通常業務",
      over_time: 1.5,
      work_time: "08:00",
      judgement: true,
    },
    def_data: { "A-1": "作業A" },
    member_data: { shop: "加工SHOP" },
  },
};

// ============================================================
// テスト本体
// ============================================================

// KosuDelete 画面の初期表示と削除処理（OK/キャンセル）・エラー処理をまとめて確認するテストグループ
describe("KosuDelete Component - 削除機能テスト", () => {

  // 各テストの前に: モックの呼び出し履歴を消し、確認ダイアログは常に「OK」、
  // alert は何もしないようにして、APIは常に上記の工数データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});

    // GET リクエストは常に削除対象の工数データを返す
    mockedApi.get.mockResolvedValue(mockResponseData);
  });

  // 【テスト】初期表示で削除対象の工数データと子部品が表示されること
  //   前提: APIは就業日 2023-10-25・ショップ「加工SHOP」の工数データを返す
  //   操作: 画面を表示する
  //   期待: 就業日「2023-10-25」が表示され、KosuDisplay にショップ名が渡り、棒グラフも表示される
  it("初期表示時にAPIからデータを取得し、正しく表示されること", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    // 検証: データの読み込みを待ち、就業日が表示されることを確認する
    expect(await screen.findByText("2023-10-25")).toBeInTheDocument();

    // 検証: 子コンポーネントがモックに置き換わって表示され、ショップ名が正しく渡っている
    const displayMock = await screen.findByTestId("mock-display");
    expect(displayMock).toHaveTextContent("加工SHOP");
    expect(screen.getByTestId("mock-bar-chart")).toBeInTheDocument();
  });

  // 【テスト】削除ボタン → 確認ダイアログで OK のとき削除APIが呼ばれ、完了後に工数履歴へ戻ること
  //   前提: 確認ダイアログは「OK」（beforeEach の設定）、削除APIは成功を返す
  //   操作: 「削除」ボタンをクリック
  //   期待: api.delete が "/api/kosu_delete/123/" で呼ばれ、
  //         alert("削除が完了しました") の後に navigate("/kosu-list") が呼ばれる
  it("削除ボタンをクリックし、確認ダイアログでOKを押すと削除APIが呼ばれること", async () => {
    // 準備: 削除APIは1回だけ成功（空のレスポンス）を返す
    mockedApi.delete.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    // 準備: 初期表示のデータ取得が終わるのを待つ
    await screen.findByText("2023-10-25");

    // 操作: 「削除」ボタンをクリック
    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    // 検証: URL の工数ID（123）を含む削除APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        "/api/kosu_delete/123/"
      );
    });

    // 検証: 完了メッセージが出て、工数履歴一覧画面（/kosu-list）へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/kosu-list");
  });

  // 【テスト】確認ダイアログでキャンセルしたときは削除APIが呼ばれないこと
  //   前提: 確認ダイアログは「キャンセル」（confirm が false を返す）
  //   操作: 「削除」ボタンをクリック
  //   期待: api.delete が一度も呼ばれない
  it("確認ダイアログでキャンセルを押した場合、削除APIは呼ばれないこと", async () => {
    // 準備: 確認ダイアログの戻り値を false（キャンセル）に上書きする
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    // 準備: 初期表示のデータ取得が終わるのを待つ
    await screen.findByText("2023-10-25");
    // 操作: 「削除」ボタンをクリック（確認ダイアログはキャンセル扱いになる）
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: 削除APIは呼ばれていない
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  // 【テスト】データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("API取得エラー（401）時にログイン画面へリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <KosuDelete />
      </MemoryRouter>
    );

    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
