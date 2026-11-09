/**
 * ============================================================
 * ファイル名 : TeamDetail.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : TeamPage/TeamDetail.tsx（班員工数履歴詳細画面）
 * 概要       : 就業日の「YYYY年M月D日(曜)」形式での表示・氏名・直の名称・残業時間（時間換算）の表示と、
 *              エラー時（401/403）の遷移を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :id を "1" に固定するため
 *   - KosuBarChart / KosuDisplay / DefTable / Loading
 *                                  : グラフ描画など画面の本質と関係ない子部品を単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import TeamDetail from "../../TeamPage/TeamDetail";

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
    // URL の :id（表示する工数データのID）を "1" に固定する
    useParams: () => ({ id: "1" }),
  };
});

// 子コンポーネントのモック
// KosuBarChart（作業内容の色分けグラフ）: グラフを描かず「Chart Mock」という文字だけを表示する
vi.mock("../../Components/KosuBarChart", () => ({
  default: () => <div data-testid="mock-bar-chart">Chart Mock</div>,
}));
// KosuDisplay（作業内容の表）: 表を作らず、受け取ったショップ（props.shop）だけを表示する
vi.mock("../../Components/KosuDisplay", () => ({
  default: (props: any) => <div data-testid="mock-display">{props.shop}</div>,
}));
// DefTable（工数区分名と色の対応表）: 表を作らず「Table Mock」という文字だけを表示する
vi.mock("../../Components/DefTable", () => ({
  default: () => <div data-testid="mock-def-table">Table Mock</div>,
}));
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// ============================================================
// テスト本体
// ============================================================

// TeamDetail 画面の基本情報の表示とエラー処理を確認するテストグループ
describe("TeamDetail Component", () => {
  // GET /api/team_detail/1/ のレスポンス例
  const mockResponse = {
    data: {
      // 工数データ（1日1人分の作業時間記録）
      kosu_data: {
        employee_no3: 101, // 従業員番号
        name: "太郎",
        work_day2: "2023-10-25", // 就業日（水曜日）
        tyoku2: "1", // 直の番号（"1" は「1直」と表示される）
        time_work: "A", // 作業内容（子部品はモックのため内容は表示に使われない）
        detail_work: "", // 作業詳細
        over_time: 60, // 残業時間（分。60分 → "1.00H" と表示される）
        work_time: "出勤", // 就業形態
        def_ver2: "v1", // 入力時の工数区分定義Ver名
        judgement: true, // 工数入力OK/NG判定
        break_change: false, // 休憩変更チェック
      },
      def_data: {}, // 工数区分定義データ（空）
      // 班員の人員データ（氏名の表示に使われる）
      member_data: { employee_no: 101, name: "太郎", shop: "P" },
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】就業日が「YYYY年M月D日(曜)」形式で表示されること
  //   前提: 就業日は "2023-10-25"（水曜日）
  //   操作: 画面を表示する
  //   期待: 「2023年10月25日(水)」が表示される
  it("フォーマットされた日付が表示されること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    // 検証: 変換後の就業日が表示される
    expect(await screen.findByText("2023年10月25日(水)")).toBeInTheDocument();
  });

  // 【テスト】班員の氏名が表示されること
  //   前提: 班員の人員データの氏名は「太郎」
  //   操作: 画面を表示する
  //   期待: 「太郎」を含む文字（氏名: 太郎）が表示される
  it("氏名が表示されること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    // 検証: 「氏名: 太郎」の一部に一致する（ラベル付きの文字なので正規表現で部分一致を確認）
    expect(await screen.findByText(/太郎/)).toBeInTheDocument();
  });

  // 【テスト】直の番号が名称に変換されて表示されること
  //   前提: 直の番号は "1"
  //   操作: 画面を表示する
  //   期待: 「1直」を含む文字（直: 1直）が表示される
  it("直が正しく表示されること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    // 検証: 「直: 1直」の一部に一致する
    expect(await screen.findByText(/1直/)).toBeInTheDocument();
  });

  // 【テスト】残業時間が分から時間に換算され、小数2桁で表示されること
  //   前提: 残業時間は 60（分）
  //   操作: 画面を表示する
  //   期待: 「1.00H」を含む文字（残業時間: 1.00H）が表示される
  it("残業時間が正しく表示されること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    // 検証: 60 ÷ 60 = 1 を小数2桁にした「1.00H」が表示される（正規表現では "." を \. と書いて文字のドットに一致させる）
    expect(await screen.findByText(/1\.00H/)).toBeInTheDocument();
  });

  // 【テスト】データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
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
        <TeamDetail />
      </MemoryRouter>
    );

    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】データ取得APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("403エラー時に/へリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403, data: { message: "Forbidden" } },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <TeamDetail />
      </MemoryRouter>
    );

    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });
});
