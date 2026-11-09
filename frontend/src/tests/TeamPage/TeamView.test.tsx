/**
 * ============================================================
 * ファイル名 : TeamView.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : TeamPage/TeamView.tsx（ショップ単位工数入力状況画面）
 * 概要       : 表示月・ショップのデータ取得・見出し/リンク/各プルダウン/Excel出力ボタン/日付見出しの表示・
 *              工数入力OK/NGの表示・年/月/ショップ変更時の POST 送信・Excel出力の POST 送信・
 *              ウィンドウサイズ変更・エラー時（401/403/500）の挙動を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading / ShopSelect         : 画面の本質と関係ない子部品を単純化するため
 *   - window.alert                 : 出力条件不足の警告ダイアログを出さないため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
// ShopSelect（表示ショップのプルダウン）: 選択肢「---」だけを持つ簡易版にし、onChange だけ本物の画面から受け取る
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import TeamView from "../../TeamPage/TeamView";

// ============================================================
// テストデータ
// ============================================================

// GET /api/team_view/ のレスポンス例（工数データなし・人員1人・2025年1月・ショップ W1）
const mockResponse = {
  data: {
    kosu_data: [], // 表示月・ショップの工数データ（ここでは0件）
    member_name_list: [[12345, "テスト太郎"]], // 表示ショップの人員の [従業員番号, 氏名] の一覧
    session_year: 2025, // セッションに保存された表示年
    session_month: 1, // セッションに保存された表示月
    shop_default: "W1", // セッションに保存された表示ショップ
  },
};

// ============================================================
// テスト本体
// ============================================================

// TeamView 画面の表示・年月/ショップの切り替え・Excel出力・エラー処理をまとめて確認するテストグループ
describe("TeamView", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、alert の無効化とAPIの既定レスポンスを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 警告ダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // データ取得APIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: APIは人員1人・工数データ0件を返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数入力状況(全体)」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数入力状況(全体)")).toBeInTheDocument();
  });

  // 【テスト】表示時に表示月・ショップの工数データを取得すること
  //   前提: APIは人員1人・工数データ0件を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/team_view/" で呼ばれる
  it("loads data from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: データ取得APIがパラメータなしで呼ばれる（表示年月・ショップはサーバー側のセッションで管理される）
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_view/");
    });
  });

  // 【テスト】データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】人員の氏名が表に表示されること
  //   前提: 人員一覧に「テスト太郎」がいる
  //   操作: 画面を表示する
  //   期待: 「テスト太郎」が表示される
  it("displays member names", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: 表の左端（氏名のセル）に人員名が表示される
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
  });

  // 【テスト】「Excelに出力」ボタンが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「Excelに出力」の文字が表示される
  it("displays Excel export button", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: Excel出力ボタンの文字がある
    expect(await screen.findByText("Excelに出力")).toBeInTheDocument();
  });

  // 【テスト】班員メニューへ戻るリンクが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: 「班員MENU」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 検証: ナビゲーション欄に班員メニュー画面へのリンクがある
    expect(screen.getByText("班員MENU")).toBeInTheDocument();
  });

  // 【テスト】表示ショップを選ぶプルダウンが表示されること
  //   前提: APIは人員データを返す
  //   操作: 画面を表示する
  //   期待: data-testid="shop-select" の要素（モックの ShopSelect）が存在する
  it("displays shop select", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 検証: ショップのプルダウンが data-testid で見つかる
    expect(screen.getByTestId("shop-select")).toBeInTheDocument();
  });

  // 【テスト】年・月のプルダウンが表示されること
  //   前提: 表示年月は2025年1月。年の選択肢は「今日の年の前後5年」で作られる
  //   操作: 画面を表示する
  //   期待: 選択肢「2025年」「1月」が表示される
  it("displays year and month selectors", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 検証: 年・月のプルダウンの選択肢の文字がある
    expect(screen.getByText("2025年")).toBeInTheDocument();
    expect(screen.getByText("1月")).toBeInTheDocument();
  });

  // 【テスト】表示月の1日〜月末の日付見出しが表示されること
  //   前提: 表示年月は2025年1月（31日まである月）
  //   操作: 画面を表示する
  //   期待: 見出し「1」と「31」が表示される
  it("displays date column headers", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 検証: 1月は31日まであるため、初日「1」と末日「31」の見出しがある
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
  });

  // 【テスト】工数データがない日は「NG」と表示されること
  //   前提: 工数データは0件
  //   操作: 画面を表示する
  //   期待: 「NG」のセルが1つ以上ある
  it("displays NG by default for member with no kosu data", async () => {
    // 準備: 画面を表示し、人員名の表示を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    // 検証: 工数データがない日はすべて「NG」になる
    const ngCells = screen.getAllByText("NG");
    expect(ngCells.length).toBeGreaterThan(0);
  });

  // 【テスト】工数入力OK判定の工数データがある日は「OK」と表示されること
  //   前提: 2025-01-15 に judgement=true の工数データが1件ある
  //   操作: 画面を表示する
  //   期待: 「OK」のセルが1つ以上ある
  it("displays OK for member with matching kosu data", async () => {
    // 準備: 既定のレスポンスに、従業員番号12345・2025-01-15 の入力OKの工数データを1件追加する
    const dataWithKosu = {
      data: {
        ...mockResponse.data,
        kosu_data: [
          { id: 1, employee_no3: 12345, name: "テスト太郎", work_day2: "2025-01-15", tyoku2: "1", work_time: "通常", time_work: "A", judgement: true, over_time: "30" },
        ],
      },
    };
    // 準備: 1回目のAPIで上のデータを返し、画面を表示して人員名の表示を待つ
    mockedApi.get.mockResolvedValueOnce(dataWithKosu);
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("テスト太郎");
    // 検証: 「従業員番号_就業日」で引いた工数データの判定が OK なので「OK」と表示される
    const okCells = screen.getAllByText("OK");
    expect(okCells.length).toBeGreaterThan(0);
  });

  // 【テスト】年のプルダウンを変更すると、新しい年が表示年月として POST されること
  //   前提: 表示年月は2025年1月、表示年月保存APIは成功を返す
  //   操作: 年のプルダウン（表示値「2025年」）を 2024 に変更
  //   期待: api.post が "/api/team_view/" と year=2024 を含むデータで呼ばれる
  it("changes year via select", async () => {
    // 準備: 表示年月保存APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 操作: 選択中の表示が「2025年」のプルダウン（年）を 2024 に変更する
    // （画面側は name 属性で年・月のどちらが変わったかを判断するため name も渡す）
    const yearSelect = screen.getByDisplayValue("2025年");
    fireEvent.change(yearSelect, { target: { name: "year", value: "2024" } });
    // 検証: 送信データに数値の year: 2024 が含まれる（月は現在の 1 のまま送られる）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_view/", expect.objectContaining({ year: 2024 }));
    });
  });

  // 【テスト】月のプルダウンを変更すると、新しい月が表示年月として POST されること
  //   前提: 表示年月は2025年1月、表示年月保存APIは成功を返す
  //   操作: 月のプルダウン（表示値「1月」）を 6 に変更
  //   期待: api.post が "/api/team_view/" と month=6 を含むデータで呼ばれる
  it("changes month via select", async () => {
    // 準備: 表示年月保存APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 操作: 選択中の表示が「1月」のプルダウン（月）を 6 に変更する
    const monthSelect = screen.getByDisplayValue("1月");
    fireEvent.change(monthSelect, { target: { name: "month", value: "6" } });
    // 検証: 送信データに数値の month: 6 が含まれる（年は現在の 2025 のまま送られる）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_view/", expect.objectContaining({ month: 6 }));
    });
  });

  // 【テスト】ウィンドウサイズが変わっても画面が壊れないこと
  //   前提: 画面は表の高さ・幅をウィンドウサイズ変更のたびに計算し直す
  //   操作: ウィンドウの resize イベントを発生させる
  //   期待: 見出し「工数入力状況(全体)」が表示されたままである
  it("handles window resize", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 操作: resize イベントを発生させる（state 更新を伴うため act で包み、更新の完了を待つ）
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    // 検証: エラーにならず画面が表示されている
    expect(screen.getByText("工数入力状況(全体)")).toBeInTheDocument();
  });

  // 【テスト】データ取得APIがサーバーエラー（401/403 以外）を返したら、そのメッセージを表示すること
  //   前提: APIは status 500・message="サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「Error: サーバーエラー」が表示される
  it("displays error state", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: 画面全体がエラー表示（"Error: " + メッセージ）に置き換わる
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】データ取得APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】ショップのプルダウンを変更すると、表示ショップ保存APIが呼ばれること
  //   前提: 表示ショップ保存APIは成功を返す
  //   操作: ショップのプルダウンに変更イベント（value="A1"）を発生させる
  //   期待: api.post が "/api/team_shop_select/" と送信データ（オブジェクト）付きで呼ばれる
  it("handles shop select change", async () => {
    // 準備: 表示ショップ保存APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 操作: ショップのプルダウンに変更イベントを発生させる
    // （モックのプルダウンには「---」の選択肢しかないため、送信される値の中身までは確認しない）
    const shopSelect = screen.getByTestId("shop-select");
    fireEvent.change(shopSelect, { target: { name: "shop1", value: "A1" } });
    // 検証: 表示ショップ保存APIが何らかのオブジェクト付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_shop_select/", expect.any(Object));
    });
  });

  // 【テスト】「Excelに出力」ボタンでExcel作成APIが呼ばれること
  //   前提: 表示年月・ショップがそろっている。Excel作成APIは空のファイルデータ（Blob）を返す
  //   操作: 「Excelに出力」ボタンをクリック
  //   期待: api.post が "/api/team_export/"・送信データ・オプション（responseType の指定）の3つの引数で呼ばれる
  it("handles Excel export click", async () => {
    // 準備: Excel作成APIが空の Blob（ファイルの中身を表すデータ）を返すようにする
    mockedApi.post.mockResolvedValue({ data: new Blob() });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><TeamView /></MemoryRouter>);
    await screen.findByText("工数入力状況(全体)");
    // 操作: 「Excelに出力」ボタンをクリック
    const exportBtn = screen.getByText("Excelに出力");
    fireEvent.click(exportBtn);
    // 検証: 年・月・ショップの送信データと、ファイルとして受け取るためのオプション付きで POST が呼ばれる
    // （ダウンロード処理そのものは確認していない）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_export/", expect.any(Object), expect.any(Object));
    });
  });
});
