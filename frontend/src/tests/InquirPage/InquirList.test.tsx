/**
 * ============================================================
 * ファイル名 : InquirList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : InquirPage/InquirList.tsx（問い合わせ履歴一覧画面）
 * 概要       : 一覧への問い合わせデータの表示・問い合わせ者名から詳細画面へのリンク・
 *              問い合わせ本文と回答が長い場合の省略表示（先頭3文字＋"..."）を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useLocation : 画面遷移先の記録と URL の固定のため
 *   - Loading / TableContainer / Pagination / TeamMemberSelect / ItemSelect
 *                                  : 画面の本質と関係ない子部品を単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import InquirList from "../../InquirPage/InquirList";

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
    // 現在のURLを問い合わせ履歴一覧画面（/inquir-list）に固定する
    useLocation: () => ({ pathname: "/inquir-list", state: null }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TableContainer: 高さ計算などを省き、中身をそのまま表示するだけにする
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
// Pagination: ページ切り替え機能は持たず、「Pagination」という文字だけを表示する
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));
// TeamMemberSelect（問い合わせ者の絞り込みプルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option></select> }));
// ItemSelect（内容の種類の絞り込みプルダウン）: 選択肢「---」だけを持つ簡易版にする
vi.mock("../../Components/ItemSelect", () => ({ default: (props: any) => <select data-testid="item-select" onChange={props.onChange} value={props.value}><option value="">---</option></select> }));

// ============================================================
// テスト本体
// ============================================================

// InquirList 画面の一覧表示とリンク・省略表示を確認するテストグループ
describe("InquirList Component", () => {
  // GET /api/inquir_list/ のレスポンス例（問い合わせ1件・全1件・1ページ20件）
  const mockResponse = {
    data: {
      // 問い合わせ一覧（ページネーション形式）
      inquir_data: {
        results: [
          {
            id: 1, // 問い合わせのID（詳細画面のURLに使われる）
            employee_no2: 101, // 問い合わせ者の従業員番号
            name: "太郎",
            content_choice: "要望", // 内容の種類
            inquiry: "テスト問い合わせ", // 問い合わせ本文（4文字以上なので省略表示される）
            answer: "回答テスト", // 回答（4文字以上なので省略表示される）
          },
        ],
        count: 1, // 全件数
        page_size: 20, // 1ページあたりの件数
      },
      // 人員一覧（従業員番号 → 氏名の変換と、絞り込みプルダウンの選択肢に使われる）
      member_data: [{ id: 1, employee_no: 101, name: "太郎" }],
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】問い合わせデータが一覧に表示され、問い合わせ者名が詳細画面へのリンクになっていること
  //   前提: APIは従業員番号101（太郎）の問い合わせ1件を返す
  //   操作: 画面を表示する
  //   期待: 「太郎」「要望」が表示され、「太郎」のリンク先が /inquir-detail/1 である
  it("テーブルにデータが表示されること、名前がリンクであること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <InquirList />
      </MemoryRouter>
    );

    // 検証: 問い合わせ者名（member_data から変換した氏名）と内容の種類が表示される
    expect(await screen.findByText("太郎")).toBeInTheDocument();
    expect(screen.getByText("要望")).toBeInTheDocument();

    // 検証: 氏名を囲む一番近い a 要素（リンク）の飛び先が、ID=1 の問い合わせ詳細画面になっている
    const nameLink = screen.getByText("太郎");
    expect(nameLink.closest("a")).toHaveAttribute("href", "/inquir-detail/1");
  });

  // 【テスト】問い合わせ本文・回答が4文字以上のとき、先頭3文字＋"..."に省略されること
  //   前提: 問い合わせ本文は「テスト問い合わせ」、回答は「回答テスト」（どちらも4文字以上）
  //   操作: 画面を表示する
  //   期待: 表のセルのうち少なくとも1つの文字に "..." が含まれる
  it("長いテキストが省略されること", async () => {
    // 準備: 画面を表示し、一覧データの表示を待つ
    render(
      <MemoryRouter>
        <InquirList />
      </MemoryRouter>
    );

    await screen.findByText("太郎");
    // 省略後の想定表示（画面側は substring(0, 3) で先頭3文字を切り出して "..." を付ける）:
    // "テスト問い合わせ" → "テスト..."
    // "回答テスト" → "回答テ..."
    // 完全一致での検索は避け、表の全セル（td）の中に "..." を含むものがあるかで確認する
    const inquiryCells = screen.getAllByRole("cell");
    const hasInquiryTruncated = inquiryCells.some(
      (cell) => cell.textContent?.includes("...")
    );
    // 検証: 省略表示されたセルが1つ以上ある
    expect(hasInquiryTruncated).toBe(true);
  });
});
