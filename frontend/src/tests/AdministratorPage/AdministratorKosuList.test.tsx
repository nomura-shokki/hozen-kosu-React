/**
 * ============================================================
 * ファイル名 : AdministratorKosuList.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorKosuList.tsx（全工数管理画面）
 * 概要       : 全人員の工数データ一覧の初期表示・エラー時の遷移/表示・直や判定の表示整形・
 *              就業日/人員/ショップ/直/勤務形態/整合性での絞り込み・ページ切り替え・0件表示を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / TableContainer / Pagination : 画面の本質と関係ない子部品を単純化するため
 *   - TeamMemberSelect / ShopSelect / TyokuSelect / WorkSelect / JudgementSelect :
 *       選択肢を固定した素の select に置き換え、テストから値を変更しやすくするため
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
// 以下の絞り込み用プルダウンは「未選択（---）」＋固定の選択肢1つだけの素の select にする
// TeamMemberSelect（人員選択）: 選択肢は 従業員番号 12345「テスト太郎」
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option><option value="12345">テスト太郎</option></select> }));
// ShopSelect（ショップ選択）: 選択肢は「W1」
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option><option value="W1">W1</option></select> }));
// TyokuSelect（直選択）: 選択肢は 値 "1"「1直」
vi.mock("../../Components/TyokuSelect", () => ({ default: (props: any) => <select data-testid="tyoku-select" onChange={props.onChange} value={props.value}><option value="">---</option><option value="1">1直</option></select> }));
// WorkSelect（就業形態選択）: 選択肢は「通常」
vi.mock("../../Components/WorkSelect", () => ({ default: (props: any) => <select data-testid="work-select" onChange={props.onChange} value={props.value}><option value="">---</option><option value="通常">通常</option></select> }));
// JudgementSelect（工数入力OK/NG判定の選択）: 選択肢は 値 "true"「OK」
// （※本物の JudgementSelect.tsx の選択肢の値は "OK" / "NG" であり、このモックの値とは異なる）
vi.mock("../../Components/JudgementSelect", () => ({ default: (props: any) => <select data-testid="judgement-select" onChange={props.onChange}><option value="">---</option><option value="true">OK</option></select> }));

// テスト対象のコンポーネント
// （vi.mock はファイル先頭へ自動的に巻き上げられるため、ここで読み込んでもモックが適用される）
import AdministratorKosuList from "../../AdministratorPage/AdministratorKosuList";

// ============================================================
// テスト用データ
// ============================================================

// 全工数一覧APIのレスポンス例（工数データ1件・全1件・1ページ20件）
const mockResponse = {
  data: {
    kosu_data: {
      results: [
        // name は空で返り、画面側で member_data の従業員番号と突き合わせて氏名を埋める
        { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "1", work_time: "通常", judgement: true },
      ],
      page_size: 20,
      count: 1,
    },
    // 人員の一覧（氏名の突き合わせと人員選択プルダウンに使われる）
    member_data: [
      { id: 1, employee_no: 12345, name: "テスト太郎" },
    ],
  },
};

// ============================================================
// テスト本体
// ============================================================

// AdministratorKosuList 画面の表示・絞り込み・ページ切り替え・エラー処理をまとめて確認するテストグループ
describe("AdministratorKosuList", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、APIは常に上記の工数データを返すように設定する
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面タイトルが表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 「全工数管理」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: データ取得が終わり画面タイトルが出るまで待って確認する
    expect(await screen.findByText("全工数管理")).toBeInTheDocument();
  });

  // 【テスト】初期表示で全工数一覧APIが呼ばれること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/manager_kosu/" と何らかのオプション（送信パラメータ）付きで呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: 全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.any(Object));
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
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】取得した工数データが氏名・判定付きで表示されること
  //   前提: APIは 従業員番号 12345（テスト太郎）・判定 OK の工数データを返す
  //   操作: 画面を表示する
  //   期待: 「テスト太郎」と「OK」がそれぞれ1個以上表示される
  it("displays data in table", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: 氏名が表示される（テーブルの氏名列と人員選択プルダウンの選択肢の両方に出るため getAll で数える）
    const cells = await screen.findAllByText("テスト太郎");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    // 検証: 判定「OK」が表示される（テーブルの整合性列と判定選択プルダウンの選択肢の両方に出る）
    const okCells = screen.getAllByText("OK");
    expect(okCells.length).toBeGreaterThanOrEqual(1);
  });

  // 【テスト】APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
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
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
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
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: 固定の不明エラーメッセージが表示される
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】管理者メニューへ戻るリンクが表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 「管理者MENU」リンクが表示される
  it("displays navigation link", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: ナビゲーションのリンク文字が表示される
    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
  });

  // 【テスト】テーブルの見出し列が表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 「氏名」「勤務形態」「整合性」の見出しが表示される
  it("displays table headers", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 検証: 各見出しが表示される（絞り込み欄のラベルは「勤務形態：」「整合性:」と記号付きのため完全一致では区別される）
    expect(screen.getByText("氏名")).toBeInTheDocument();
    expect(screen.getByText("勤務形態")).toBeInTheDocument();
    expect(screen.getByText("整合性")).toBeInTheDocument();
  });

  // 【テスト】各行に「編集」リンクが表示されること
  //   前提: APIは工数データ1件を返す
  //   操作: 画面を表示する
  //   期待: 「編集」の文字が1個以上ある（見出し列の「編集」と行のリンク）
  it("displays edit link for each row", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 検証: 「編集」の文字が1個以上ある
    const editLinks = screen.getAllByText("編集");
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
  });

  // 【テスト】直の値 "1" が「1直」と表示されること
  //   前提: APIは tyoku2="1" の工数データを返す
  //   操作: 画面を表示する
  //   期待: 「1直」の文字が1個以上ある
  it("formats tyoku correctly (1直)", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 検証: 「1直」が表示される（テーブルの直列と直選択プルダウンの選択肢の両方に出るため getAll で数える）
    const matches = screen.getAllByText("1直");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // 【テスト】判定が false の工数データは「NG」と表示されること
  //   前提: APIは1回目の呼び出しで judgement=false の工数データを返す
  //   操作: 画面を表示する
  //   期待: 「NG」が表示される
  it("displays NG for false judgement", async () => {
    // 準備: 1回目のAPI呼び出しを、判定 NG（judgement: false）の工数データにする
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: {
          results: [
            { id: 2, employee_no3: 12345, name: "", work_day2: "2025-01-02", tyoku2: "2", work_time: "通常", judgement: false },
          ],
          page_size: 20,
          count: 1,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: 整合性列に「NG」が表示される
    expect(await screen.findByText("NG")).toBeInTheDocument();
  });

  // 【テスト】工数データが0件のときは「No data found.」と表示されること
  //   前提: APIは1回目の呼び出しで results が空（0件）のデータを返す
  //   操作: 画面を表示する
  //   期待: 「No data found.」が表示される
  it("shows No data found when results are empty", async () => {
    // 準備: 1回目のAPI呼び出しを0件のレスポンスにする
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: { results: [], page_size: 20, count: 0 },
        member_data: [],
      },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: 0件時のメッセージが表示される
    expect(await screen.findByText("No data found.")).toBeInTheDocument();
  });

  // 【テスト】就業日を変更するとその日付で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 就業日欄に 2025-06-01 を入力する（ボタンは押さない。入力の時点で再取得される）
  //   期待: api.get が day="2025-06-01" のパラメータ付きで呼ばれる
  it("handles date search change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 「就業日：」ラベルに紐づく日付欄に入力する
    const dateInput = screen.getByLabelText(/就業日/);
    fireEvent.change(dateInput, { target: { value: "2025-06-01" } });
    // 検証: 入力日付を送る全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          day: "2025-06-01",
        }),
      }));
    });
  });

  // 【テスト】「指定月」ボタンを押してもエラーにならず、APIが呼ばれていること
  //   前提: 初期表示が完了している
  //   操作: 「指定月」をクリック
  //   期待: api.get が（1回以上）呼ばれている
  it("handles 指定月 button click", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 「指定月」ボタンをクリック
    const monthBtn = screen.getByText("指定月");
    fireEvent.click(monthBtn);
    // 検証: api.get が呼ばれている（初期表示時の呼び出しも含めて数えている点に注意）
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  // 【テスト】「指定日」ボタンを押してもエラーにならず、APIが呼ばれていること
  //   前提: 初期表示が完了している
  //   操作: 「指定日」をクリック
  //   期待: api.get が（1回以上）呼ばれている
  it("handles 指定日 button click", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 「指定日」ボタンをクリック
    const dayBtn = screen.getByText("指定日");
    fireEvent.click(dayBtn);
    // 検証: api.get が呼ばれている（初期表示時の呼び出しも含めて数えている点に注意）
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  // 【テスト】人員を選択するとその従業員番号で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 人員選択で 12345（テスト太郎）を選ぶ
  //   期待: api.get が member="12345" のパラメータ付きで呼ばれる
  it("handles member select filter change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 人員選択（モック）の値を 12345 に変更する
    const memberSelect = screen.getByTestId("member-select");
    fireEvent.change(memberSelect, { target: { value: "12345" } });
    // 検証: 選択した従業員番号を送る全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          member: "12345",
        }),
      }));
    });
  });

  // 【テスト】ショップを選択するとそのショップで絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: ショップ選択で W1 を選ぶ
  //   期待: api.get が shop="W1" のパラメータ付きで呼ばれる
  it("handles shop select filter change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: ショップ選択（モック）の値を W1 に変更する
    const shopSelect = screen.getByTestId("shop-select");
    fireEvent.change(shopSelect, { target: { value: "W1" } });
    // 検証: 選択したショップを送る全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          shop: "W1",
        }),
      }));
    });
  });

  // 【テスト】直を選択するとその直で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 直選択で "1"（1直）を選ぶ
  //   期待: api.get が tyoku="1" のパラメータ付きで呼ばれる
  it("handles tyoku select filter change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 直選択（モック）の値を "1" に変更する
    const tyokuSelect = screen.getByTestId("tyoku-select");
    fireEvent.change(tyokuSelect, { target: { value: "1" } });
    // 検証: 選択した直を送る全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          tyoku: "1",
        }),
      }));
    });
  });

  // 【テスト】勤務形態（就業形態）を選択するとその値で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 勤務形態選択で「通常」を選ぶ
  //   期待: api.get が work="通常" のパラメータ付きで呼ばれる
  it("handles work select filter change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 勤務形態選択（モック）の値を「通常」に変更する
    const workSelect = screen.getByTestId("work-select");
    fireEvent.change(workSelect, { target: { value: "通常" } });
    // 検証: 選択した勤務形態を送る全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          work: "通常",
        }),
      }));
    });
  });

  // 【テスト】整合性（工数入力OK/NG判定）を選択するとその値で絞り込むパラメータが送信されること
  //   前提: 初期表示が完了している
  //   操作: 整合性選択で "true"（OK）を選ぶ
  //   期待: api.get が judgement="true" のパラメータ付きで呼ばれる
  it("handles judgement select filter change", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 整合性選択（モック）の値を "true" に変更する
    const judgementSelect = screen.getByTestId("judgement-select");
    fireEvent.change(judgementSelect, { target: { value: "true" } });
    // 検証: 選択した判定値を送る全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          judgement: "true",
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
        kosu_data: {
          results: [
            { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "1", work_time: "通常", judgement: true },
          ],
          page_size: 20,
          count: 40,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 操作: 「Page 2」ボタンをクリック
    const page2Btn = screen.getByText("Page 2");
    fireEvent.click(page2Btn);
    // 検証: 2ページ目を要求する全工数一覧APIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_kosu/", expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
        }),
      }));
    });
  });

  // 【テスト】就業日の列に日付が表示されること
  //   前提: APIは work_day2="2025-01-01" の工数データを返す
  //   操作: 画面を表示する
  //   期待: 「2025-01-01」を含む文字（"2025-01-01 (水)" の形式で表示される）がある
  it("displays work_day2 with day of week", async () => {
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 2025-01-01 は水曜日のため画面には "2025-01-01 (水)" と出るが、
    // ここでは正規表現（部分一致）で日付部分が含まれることだけを確認している
    // 検証: 日付を含む表示がある
    expect(screen.getByText(/2025-01-01/)).toBeInTheDocument();
  });

  // 【テスト】人員一覧に存在しない従業員番号の工数データは「Unknown (番号)」と表示されること
  //   前提: APIは従業員番号 99999 の工数データを返すが、人員一覧には 12345 しかない
  //   操作: 画面を表示する
  //   期待: 「Unknown (99999)」が表示される
  it("shows Unknown name for unmatched employee_no", async () => {
    // 準備: 1回目のAPI呼び出しを、人員一覧に無い従業員番号 99999 の工数データにする
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: {
          results: [
            { id: 3, employee_no3: 99999, name: "", work_day2: "2025-01-01", tyoku2: "4", work_time: "通常", judgement: true },
          ],
          page_size: 20,
          count: 1,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    // 検証: 氏名の代わりに「Unknown (99999)」が表示される
    expect(await screen.findByText("Unknown (99999)")).toBeInTheDocument();
  });

  // 【テスト】直の値 "2" / "3" / "4" がそれぞれ「2直」「3直」「常昼」と表示されること
  //   前提: APIは tyoku2 が "2" / "3" / "4" の工数データ3件を返す
  //   操作: 画面を表示する
  //   期待: 「2直」「3直」「常昼」が表示される
  it("formats different tyoku values", async () => {
    // 準備: 1回目のAPI呼び出しを、直だけが異なる工数データ3件にする
    mockedApi.get.mockResolvedValueOnce({
      data: {
        kosu_data: {
          results: [
            { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "2", work_time: "通常", judgement: true },
            { id: 2, employee_no3: 12345, name: "", work_day2: "2025-01-02", tyoku2: "3", work_time: "通常", judgement: true },
            { id: 3, employee_no3: 12345, name: "", work_day2: "2025-01-03", tyoku2: "4", work_time: "通常", judgement: true },
          ],
          page_size: 20,
          count: 3,
        },
        member_data: [{ id: 1, employee_no: 12345, name: "テスト太郎" }],
      },
    });
    // 準備: 画面を表示し、データ取得が終わるのを待つ
    render(<MemoryRouter><AdministratorKosuList /></MemoryRouter>);
    await screen.findByText("全工数管理");
    // 検証: 各直の表示名に変換されている（"4" は常昼）
    expect(screen.getByText("2直")).toBeInTheDocument();
    expect(screen.getByText("3直")).toBeInTheDocument();
    expect(screen.getByText("常昼")).toBeInTheDocument();
  });
});
