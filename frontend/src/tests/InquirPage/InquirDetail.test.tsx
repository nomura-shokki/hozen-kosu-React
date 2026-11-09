/**
 * ============================================================
 * ファイル名 : InquirDetail.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : InquirPage/InquirDetail.tsx（問い合わせ詳細画面）
 * 概要       : 問い合わせ内容と回答の表示・「編集」リンクの表示条件（管理者または問い合わせ者本人）・
 *              前後の問い合わせへ移動する「前へ」「次へ」ボタンの表示条件を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の記録と URL の :id を "1" に固定するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import InquirDetail from "../../InquirPage/InquirDetail";

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
    // URL の :id（表示する問い合わせのID）を "1" に固定する
    useParams: () => ({ id: "1" }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));

// ============================================================
// テスト本体
// ============================================================

// InquirDetail 画面の内容表示と、編集リンク・前後移動ボタンの出し分けを確認するテストグループ
describe("InquirDetail Component", () => {
  // GET /api/inquir_detail/1/ のレスポンス例
  // （ログイン者は管理者で、かつ問い合わせ者本人。次の問い合わせはあり、前の問い合わせはなし）
  const mockResponse = {
    data: {
      // 問い合わせデータ
      inquir_data: {
        employee_no2: 101, // 問い合わせ者の従業員番号
        content_choice: "要望", // 内容の種類
        inquiry: "テスト", // 問い合わせ本文
        answer: "回答", // 回答
      },
      // ログイン者の人員データ（編集リンクを出すかどうかの判定に使われる）
      login_data: {
        employee_no: 101,
        name: "太郎",
        shop: "P",
        authority: true,
        administrator: true, // 管理者
      },
      // 問い合わせ者の人員データ（氏名の表示に使われる）
      inquir_member_data: {
        employee_no: 101,
        name: "太郎",
      },
      next_id: 2, // 次の問い合わせのID（null なら「次へ」ボタンを出さない）
      before_id: null, // 前の問い合わせのID（null なら「前へ」ボタンを出さない）
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上の mockResponse を返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】見出しと問い合わせ本文・回答が表示されること
  //   前提: APIは問い合わせ「テスト」・回答「回答」のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「問い合わせ詳細」、「テスト」、「回答」が表示される
  it("問い合わせ詳細の見出しと内容が表示されること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("問い合わせ詳細")).toBeInTheDocument();
    // 検証: 問い合わせ本文と回答が表示される
    expect(screen.getByText("テスト")).toBeInTheDocument();
    expect(screen.getByText("回答")).toBeInTheDocument();
  });

  // 【テスト】ログイン者が管理者の場合、「編集」リンクが表示されること
  //   前提: ログイン者は管理者（administrator: true）。問い合わせ者本人でもある
  //   操作: 画面を表示する
  //   期待: 「編集」リンクが表示される
  it("管理者の場合に編集リンクが表示されること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    // 検証: 問い合わせ編集画面への「編集」リンクがある
    expect(await screen.findByText("編集")).toBeInTheDocument();
  });

  // 【テスト】次の問い合わせがあれば「次へ」、前の問い合わせがなければ「前へ」を出さないこと
  //   前提: next_id=2、before_id=null
  //   操作: 画面を表示する
  //   期待: 「次へ」ボタンは表示され、「前へ」ボタンは表示されない
  it("next_idがある場合に次へボタンが表示され、before_idがnullの場合に前へボタンが非表示であること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    // 検証: 「次へ ▶」ボタンがある（記号付きの文字なので正規表現で部分一致を確認）
    expect(await screen.findByText(/次へ/)).toBeInTheDocument();
    // 検証: 「◀ 前へ」ボタンはない
    expect(screen.queryByText(/前へ/)).not.toBeInTheDocument();
  });

  // 【テスト】前の問い合わせがあれば「前へ」、次の問い合わせがなければ「次へ」を出さないこと
  //   前提: next_id=null、before_id=1
  //   操作: 画面を表示する
  //   期待: 「前へ」ボタンは表示され、「次へ」ボタンは表示されない
  it("before_idがある場合に前へボタンが表示されること", async () => {
    // 準備: 1回目のAPIだけ、次のIDなし・前のIDありのデータを返す（他の項目は mockResponse と同じ）
    mockedApi.get.mockResolvedValueOnce({
      data: {
        ...mockResponse.data,
        next_id: null,
        before_id: 1,
      },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    // 検証: 「◀ 前へ」ボタンがある
    expect(await screen.findByText(/前へ/)).toBeInTheDocument();
    // 検証: 「次へ ▶」ボタンはない
    expect(screen.queryByText(/次へ/)).not.toBeInTheDocument();
  });

  // 【テスト】ログイン者が管理者でも問い合わせ者本人でもない場合、「編集」リンクが表示されないこと
  //   前提: ログイン者は従業員番号101・管理者ではない。問い合わせ者は従業員番号999
  //   操作: 画面を表示する
  //   期待: 「編集」リンクが表示されない
  it("非管理者かつ非作成者の場合に編集リンクが非表示であること", async () => {
    // 準備: 1回目のAPIで、他人（999）の問い合わせを一般ユーザー（101）が見ているデータを返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        inquir_data: {
          employee_no2: 999,
          content_choice: "要望",
          inquiry: "テスト",
          answer: "回答",
        },
        login_data: {
          employee_no: 101,
          name: "太郎",
          shop: "P",
          authority: false,
          administrator: false,
        },
        inquir_member_data: { employee_no: 999, name: "他者" },
        next_id: null,
        before_id: null,
      },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirDetail />
      </MemoryRouter>
    );

    // 準備: 読み込み完了（見出しの表示）を待つ
    await screen.findByText("問い合わせ詳細");
    // 検証: 「編集」リンクはない（queryBy は見つからないと null を返すため非表示の確認に使う）
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
  });
});
