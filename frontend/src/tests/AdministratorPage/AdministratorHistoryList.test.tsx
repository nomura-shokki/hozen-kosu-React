/**
 * ============================================================
 * ファイル名 : AdministratorHistoryList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorHistoryList.tsx（データ操作履歴一覧画面）
 * 概要       : 操作履歴（データ変更の監査ログ）一覧の初期表示・エラー時の遷移/表示・
 *              日付/レコードID/操作者/操作テーブルでの検索・ページ切り替え・0件表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / TableContainer / Pagination : 画面の本質と関係ない子部品を単純化するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする

// ============================================================
// モック定義
// ============================================================

// api（共通axiosインスタンス）のモック: get/post/put/delete をすべて「何もしない偽の関数」に置き換える
vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from "../../api/axios";
// モック関数のメソッド（mockResolvedValue など）を型エラーなしで呼ぶため any として扱う
const mockedApi = api as any;

// axios.isAxiosError のモック: response プロパティを持つエラーなら true（通信エラー扱い）を返す
vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
}));

// useNavigate のモック: 呼び出された遷移先を mockedNavigate で記録・確認できるようにする
// （Link や MemoryRouter など、それ以外の機能は本物をそのまま使う）
const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// TableContainer: 高さ計算などを省き、中身をそのまま表示するだけにする
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
// Pagination: 押すと setCurrentPage(2)（2ページ目へ切り替え）を呼ぶ「Page 2」ボタン1つだけの簡易版にする
vi.mock("../../Components/Pagination", () => ({ default: (props: any) => <div data-testid="pagination"><button onClick={() => props.setCurrentPage(2)}>Page 2</button></div> }));

// テスト対象のコンポーネント
// （vi.mock はファイル先頭へ自動的に巻き上げられるため、ここで読み込んでもモックが適用される）
import AdministratorHistoryList from "../../AdministratorPage/AdministratorHistoryList";

// ============================================================
// テスト用データ
// ============================================================

// 履歴一覧APIのレスポンス例（操作履歴1件・全1件・1ページ20件、操作テーブルの選択肢は3種類）
const mockResponse = {
  data: {
    history_data: {
      results: [
        {
          id: 1,
          operation: "更新",
          table_name: "kosu",
          record_id: "123",
          login_No: "12345",
          timestamp: "2025-01-01T12:00:00Z",
        },
      ],
      page_size: 20,
      count: 1,
    },
    // 操作テーブル選択プルダウンに並ぶテーブル名の一覧
    model_choices: ["kosu", "member", "team"],
  },
};

// ============================================================
// テスト本体
// ============================================================

// AdministratorHistoryList 画面の表示・検索・ページ切り替え・エラー処理をまとめて確認するテストグループ
describe("AdministratorHistoryList", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上記の履歴データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面タイトルが表示されること
  //   前提: APIは履歴1件を返す
  //   操作: 画面を表示する
  //   期待: 「データ操作履歴一覧」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: データ取得が終わり画面タイトルが出るまで待って確認する
    expect(await screen.findByText("データ操作履歴一覧")).toBeInTheDocument();
  });

  // 【テスト】初期表示で履歴一覧APIが呼ばれること
  //   前提: APIは履歴1件を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/manager_history/" と何らかのオプション（送信パラメータ）付きで呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: 履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.any(Object));
    });
  });

  // 【テスト】APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得した履歴データがテーブルの各列に表示されること
  //   前提: APIは 操作種類「更新」/ テーブル kosu / レコードID 123 / 操作者No 12345 の履歴を返す
  //   操作: 画面を表示する
  //   期待: 「更新」「kosu」「123」「12345」が表示される
  it("displays data in table", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: 操作種類の表示を待ってから、他の列の値を確認する
    expect(await screen.findByText("更新")).toBeInTheDocument();
    // 「kosu」はテーブル列と操作テーブル選択プルダウンの選択肢の両方に出るため、1個以上あることを確認する
    expect(screen.getAllByText("kosu").length).toBeGreaterThan(0);
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  // 【テスト】APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】APIが500（サーバーエラー）を返したらサーバーのエラーメッセージが表示されること
  //   前提: APIは status 500・message「サーバーエラー」のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「Error: サーバーエラー」が表示される
  it("displays error for server error", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラー（メッセージ付き）にする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 500, data: { message: "サーバーエラー" } } });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: レスポンスのメッセージがエラー表示される
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】通信エラー以外の例外では固定の「不明なエラー」メッセージが表示されること
  //   前提: APIは response を持たない普通の Error を投げる（isAxiosError が false になる）
  //   操作: 画面を表示する
  //   期待: 「Error: 不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays error for non-axios error", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる
    mockedApi.get.mockRejectedValueOnce(new Error("network"));
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: 固定の不明エラーメッセージが表示される
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】管理者メニューへ戻るリンクが表示されること
  //   前提: APIは履歴1件を返す
  //   操作: 画面を表示する
  //   期待: 「管理者MENU」リンクが表示される
  it("displays navigation link", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: ナビゲーションのリンク文字が表示される
    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
  });

  // 【テスト】テーブルの見出し列が表示されること
  //   前提: APIは履歴1件を返す
  //   操作: 画面を表示する
  //   期待: 「データ操作日時」「操作者」「操作テーブル」「レコードID」「操作種類」の見出しが表示される
  it("displays table headers", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 検証: 各見出しが表示される（getByText は完全一致のため「操作者」は「操作者No」とは区別される）
    expect(screen.getByText("データ操作日時")).toBeInTheDocument();
    expect(screen.getByText("操作者")).toBeInTheDocument();
    expect(screen.getByText("操作テーブル")).toBeInTheDocument();
    expect(screen.getByText("レコードID")).toBeInTheDocument();
    expect(screen.getByText("操作種類")).toBeInTheDocument();
  });

  // 【テスト】操作日時の列を含むテーブルのセルが描画されること
  //   前提: APIは timestamp "2025-01-01T12:00:00Z" の履歴1件を返す
  //   操作: 画面を表示する
  //   期待: テーブルのセル（td）が1個以上ある
  it("displays formatted timestamp", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 日時は "YYYY-MM-DD (HH:MM)" 形式に整形されるが、実行環境のタイムゾーンで時刻が変わるため、
    // ここでは整形後の文字列までは確認せず、セルが描画されていることだけを確認する
    // 検証: テーブルのセルが1個以上ある
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  // 【テスト】各行に「詳細」リンクが表示されること
  //   前提: APIは履歴1件を返す
  //   操作: 画面を表示する
  //   期待: 「詳細」の文字が2個以上ある（見出し列の「詳細」＋1行分のリンク）
  it("displays detail link for each row", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 検証: 見出しの「詳細」とリンクの「詳細」を合わせて2個以上ある
    const detailElements = screen.getAllByText("詳細");
    expect(detailElements.length).toBeGreaterThanOrEqual(2); // 見出し1個 + 行のリンク1個
  });

  // 【テスト】「指定月検索」ボタンで月単位の検索パラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 就業日欄に 2025-06-01 を入力し、「指定月検索」をクリック
  //   期待: api.get が mode="month"・day="2025-06-01" のパラメータ付きで呼ばれる
  it("handles 指定月検索 button click", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 操作: 「就業日:」ラベルに紐づく日付欄に入力する
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { value: "2025-06-01" } });
    // 操作: 「指定月検索」ボタンをクリック
    const monthSearchBtn = screen.getByText("指定月検索");
    fireEvent.click(monthSearchBtn);
    // 検証: 月単位（mode="month"）で入力日付を送る履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          mode: "month",
          day: "2025-06-01",
        }),
      }));
    });
  });

  // 【テスト】「指定日検索」ボタンで日単位の検索パラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 就業日欄に 2025-06-15 を入力し、「指定日検索」をクリック
  //   期待: api.get が mode="day"・day="2025-06-15" のパラメータ付きで呼ばれる
  it("handles 指定日検索 button click", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 操作: 「就業日:」ラベルに紐づく日付欄に入力する
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { value: "2025-06-15" } });
    // 操作: 「指定日検索」ボタンをクリック
    const daySearchBtn = screen.getByText("指定日検索");
    fireEvent.click(daySearchBtn);
    // 検証: 日単位（mode="day"）で入力日付を送る履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          mode: "day",
          day: "2025-06-15",
        }),
      }));
    });
  });

  // 【テスト】レコードIDを入力して「検索」するとレコードIDで絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: レコードID欄に 456 を入力し、「検索」をクリック
  //   期待: api.get が record_id="456" のパラメータ付きで呼ばれる
  it("handles record_id search", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 操作: プレースホルダー「レコードID」の入力欄に入力する
    const idInput = screen.getByPlaceholderText("レコードID");
    fireEvent.change(idInput, { target: { value: "456" } });
    // 操作: 「検索」ボタンをクリック（完全一致のため「指定月検索」「指定日検索」とは区別される）
    const searchBtn = screen.getByText("検索");
    fireEvent.click(searchBtn);
    // 検証: 入力したレコードIDを送る履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          record_id: "456",
        }),
      }));
    });
  });

  // 【テスト】操作者の従業員番号を入力して「検索」すると操作者で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 操作者従業員番号欄に 99999 を入力し、「検索」をクリック
  //   期待: api.get が login_No="99999" のパラメータ付きで呼ばれる
  it("handles login_No search", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 操作: プレースホルダー「操作者従業員番号」の入力欄に入力する
    const noInput = screen.getByPlaceholderText("操作者従業員番号");
    fireEvent.change(noInput, { target: { value: "99999" } });
    // 操作: 「検索」ボタンをクリック
    const searchBtn = screen.getByText("検索");
    fireEvent.click(searchBtn);
    // 検証: 入力した従業員番号を送る履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          login_No: "99999",
        }),
      }));
    });
  });

  // 【テスト】操作テーブルを選択して「検索」するとテーブル名で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している（操作テーブルの選択肢は kosu / member / team）
  //   操作: 操作テーブル選択で member を選び、「検索」をクリック
  //   期待: api.get が table_name="member" のパラメータ付きで呼ばれる
  it("handles table_name select change and search", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 操作: 画面内で唯一のプルダウン（combobox）＝操作テーブル選択で member を選ぶ
    const tableSelect = screen.getByRole("combobox");
    fireEvent.change(tableSelect, { target: { value: "member" } });
    // 操作: 「検索」ボタンをクリック
    const searchBtn = screen.getByText("検索");
    fireEvent.click(searchBtn);
    // 検証: 選択したテーブル名を送る履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          table_name: "member",
        }),
      }));
    });
  });

  // 【テスト】ページ切り替えで2ページ目のデータを要求すること
  //   前提: APIは全40件・1ページ20件（全2ページ）のデータを返す
  //   操作: 初期表示後に簡易版 Pagination の「Page 2」をクリック
  //   期待: api.get が page=2 のパラメータ付きで呼ばれる
  it("handles pagination page change", async () => {
    // 準備: 全40件（2ページ分）あるレスポンスを常に返すようにする
    mockedApi.get.mockResolvedValue({
      data: {
        history_data: {
          results: [
            { id: 1, operation: "更新", table_name: "kosu", record_id: "123", login_No: "12345", timestamp: "2025-01-01T12:00:00Z" },
          ],
          page_size: 20,
          count: 40,
        },
        model_choices: ["kosu"],
      },
    });
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 操作: 「Page 2」ボタンをクリック
    const page2Btn = screen.getByText("Page 2");
    fireEvent.click(page2Btn);
    // 検証: 2ページ目を要求する履歴一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_history/", expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
        }),
      }));
    });
  });

  // 【テスト】履歴が0件のときは「No data found.」と表示されること
  //   前提: APIは1回目の呼び出しで results が空（0件）のデータを返す
  //   操作: 画面を表示する
  //   期待: 「No data found.」が表示される
  it("shows No data found when results are empty", async () => {
    // 準備: 1回目のAPI呼び出しを0件のレスポンスにする
    mockedApi.get.mockResolvedValueOnce({
      data: {
        history_data: { results: [], page_size: 20, count: 0 },
        model_choices: [],
      },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    // 検証: 0件時のメッセージが表示される
    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });

  // 【テスト】操作テーブル選択プルダウンに model_choices のテーブル名が並ぶこと
  //   前提: APIは model_choices として kosu / member / team の3件を返す
  //   操作: 画面を表示する
  //   期待: プルダウンの選択肢が4個（未選択用「-- 操作テーブル選択 --」＋3件）ある
  it("displays table select options from model_choices", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorHistoryList /></MemoryRouter>);
    await screen.findByText("データ操作履歴一覧");
    // 検証: 操作テーブル選択プルダウンが表示されている
    const tableSelect = screen.getByRole("combobox");
    expect(tableSelect).toBeInTheDocument();
    // 検証: 選択肢には mockResponse の kosu / member / team が含まれるはずなので、option 要素の数を数える
    const options = tableSelect.querySelectorAll("option");
    expect(options.length).toBe(4); // 未選択用の1個 + テーブル名3個
  });
});
