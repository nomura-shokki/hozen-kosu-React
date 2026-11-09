/**
 * ============================================================
 * ファイル名 : AdministratorLoading.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : AdministratorPage/AdministratorLoading.tsx（データ管理画面）
 * 概要       : 各種データのバックアップ / 削除 / ロード（ファイル取り込み）を行う管理者用画面について、
 *              初期表示・権限チェック時のエラー遷移・各ボタンの表示・期間指定欄の入力・
 *              各ボタン押下で正しい非同期タスク（バックグラウンド処理）開始APIが呼ばれることを確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios（isAxiosError / AxiosError） : 対象画面が読み込む axios の機能を、通信しない簡易版に置き換えるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading                      : 画面の本質と関係ない子部品を単純化するため
 *   - window.alert                 : ブラウザの通知ダイアログを出さず、呼ばれたかどうかを確認するため
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

// axios のモック
//   isAxiosError: response プロパティを持つエラーなら true（通信エラー扱い）を返す
//   AxiosError  : 対象画面が axios から AxiosError を名前付きで読み込んでいるため、
//                 同名のクラスを用意する（response を null で持つだけの簡易版）
vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
  AxiosError: class extends Error {
    response: any;
    constructor(message?: string) {
      super(message);
      this.response = null;
    }
  },
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

// テスト対象のコンポーネント
// （vi.mock はファイル先頭へ自動的に巻き上げられるため、ここで読み込んでもモックが適用される）
import AdministratorLoading from "../../AdministratorPage/AdministratorLoading";

// ============================================================
// テスト本体
// ============================================================

// 画面上のボタンの並び順（getAllByDisplayValue で取得したときの添字）:
//   「バックアップ開始」: [0]工数 [1]工数区分定義 [2]作業詳細選択肢 [3]人員 [4]班員
//                         [5]問い合わせ [6]設定 [7]タスク履歴（非同期タスク） [8]操作履歴
//   「削除開始」        : [0]工数 [1]タスク履歴（非同期タスク） [2]操作履歴
// type="button" の input はボタンの文字が value 属性に入るため、表示値（DisplayValue）で探す

// AdministratorLoading 画面の表示・入力・各タスク開始処理・エラー処理をまとめて確認するテストグループ
describe("AdministratorLoading", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、通知ダイアログは何もしない設定にし、
  // GET（初期表示時の権限チェック GET /api/manager_loading/）は常に空データで成功させる
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  // 【テスト】画面タイトルが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「データ管理」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    // 検証: 権限チェックが終わり画面タイトルが出るまで待って確認する
    expect(await screen.findByText("データ管理")).toBeInTheDocument();
  });

  // 【テスト】初期表示で権限チェックAPIが呼ばれること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: api.get が "/api/manager_loading/"（kosu/urls.py の定義と同じ小文字の綴り）で呼ばれる
  it("loads auth check from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    // 検証: 権限チェックAPIが呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_loading/");
    });
  });

  // 【テスト】権限チェックAPIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: 権限チェックAPIは status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
      message: "Unauthorized",
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    // 検証: ログイン画面（"/login"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】「バックアップ開始」ボタンが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「バックアップ開始」ボタンが1個以上ある
  it("displays backup buttons", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: value が「バックアップ開始」のボタンが1個以上ある
    expect(screen.getAllByDisplayValue("バックアップ開始").length).toBeGreaterThan(0);
  });

  // 【テスト】管理者メニューへ戻るリンクが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「管理者MENU」リンクが表示される
  it("displays navigation link to manager menu", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: ナビゲーションのリンク文字が表示される
    expect(screen.getByText("管理者MENU")).toBeInTheDocument();
  });

  // 【テスト】期間指定（バックアップ・削除の対象期間）の入力欄が表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「期間指定：」ラベルに紐づく入力欄（開始日）がある
  it("displays date range inputs", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: ラベル文字から開始日の入力欄を探して存在を確認する
    const startInput = screen.getByLabelText(/期間指定/);
    expect(startInput).toBeInTheDocument();
  });

  // 【テスト】「削除開始」ボタンが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「削除開始」ボタンが1個以上ある
  it("displays delete buttons for kosu data", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: value が「削除開始」のボタンが1個以上ある
    expect(screen.getAllByDisplayValue("削除開始").length).toBeGreaterThan(0);
  });

  // 【テスト】「ロード開始」ボタンが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「ロード開始」ボタンが1個以上ある
  it("displays load buttons", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: value が「ロード開始」のボタンが1個以上ある
    expect(screen.getAllByDisplayValue("ロード開始").length).toBeGreaterThan(0);
  });

  // 【テスト】工数・人員・班員データの各欄の見出しが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 「工数データ」「人員データ」「班員データ」を含む見出しラベルがある
  it("displays file upload inputs", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: 各欄の見出しを正規表現（部分一致）で確認する（見出しは「工数データ(…)：」のように後ろに文字が続くため）
    expect(screen.getByText(/工数データ/)).toBeInTheDocument();
    expect(screen.getByText(/人員データ/)).toBeInTheDocument();
    expect(screen.getByText(/班員データ/)).toBeInTheDocument();
  });

  // 【テスト】その他のデータ種別の欄の見出しが表示されること
  //   前提: 権限チェックAPIは成功する
  //   操作: 画面を表示する
  //   期待: 工数区分定義・問い合わせ・設定・タスク履歴・操作履歴の各データの見出しがある
  it("displays all data section labels", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: 各欄の見出しを正規表現（部分一致）で確認する
    expect(screen.getByText(/工数区分定義データ/)).toBeInTheDocument();
    expect(screen.getByText(/問い合わせデータ/)).toBeInTheDocument();
    expect(screen.getByText(/設定データ/)).toBeInTheDocument();
    expect(screen.getByText(/タスク履歴データ/)).toBeInTheDocument();
    expect(screen.getByText(/操作履歴データ/)).toBeInTheDocument();
  });

  // 【テスト】工数データの「バックアップ開始」で工数バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す（タスク開始成功）、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 1つ目（工数データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/kosu_backup/" と送信データ（期間指定の開始日・終了日）付きで呼ばれる
  it("starts kosu backup when button is clicked", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "task123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} }) // 権限チェック
      .mockResolvedValue({ data: { status: "success", file_path: "/path/to/file" } }); // タスク状態確認
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 工数データの「バックアップ開始」（添字0）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[0]);
    // 検証: 工数バックアップ開始APIが送信データ付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/kosu_backup/", expect.any(Object));
    });
  });

  // 【テスト】権限チェックAPIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: 権限チェックAPIは status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 403 },
      message: "Forbidden",
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】期間指定の開始日を変更できること
  //   前提: 初期表示が完了している（開始日の初期値は今日）
  //   操作: 開始日欄（id="start_day"）に 2025-06-01 を入力する
  //   期待: 開始日欄の値が "2025-06-01" になる
  it("changes start_day value", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 開始日欄に入力する
    const startInput = document.getElementById("start_day") as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: "2025-06-01" } });
    // 検証: 入力値が反映されている
    expect(startInput.value).toBe("2025-06-01");
  });

  // 【テスト】期間指定の終了日を変更できること
  //   前提: 初期表示が完了している（終了日の初期値は今日）
  //   操作: 終了日欄（id="end_day"）に 2025-12-31 を入力する
  //   期待: 終了日欄の値が "2025-12-31" になる
  it("changes end_day value", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 終了日欄に入力する
    const endInput = document.getElementById("end_day") as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: "2025-12-31" } });
    // 検証: 入力値が反映されている
    expect(endInput.value).toBe("2025-12-31");
  });

  // 【テスト】工数区分定義データの「バックアップ開始」で定義バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 2つ目（工数区分定義データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/def_backup/" と undefined（期間指定なしのため送信データ無し）で呼ばれる
  it("starts def backup when button is clicked", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "task456" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} }) // 権限チェック
      .mockResolvedValue({ data: { status: "success", file_path: "/path" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    // 操作: 2つ目（添字1）は工数区分定義データのバックアップボタン
    fireEvent.click(backupBtns[1]);
    // 検証: 定義バックアップ開始APIが送信データ無しで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_backup/", undefined);
    });
  });

  // 【テスト】工数データの「削除開始」で工数削除開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 1つ目（工数データ）の「削除開始」をクリック
  //   期待: api.post が "/api/kosu_delet/" と送信データ（期間指定の開始日・終了日）付きで呼ばれる
  it("starts kosu delete when button is clicked", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "task789" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 工数データの「削除開始」（添字0）をクリック
    const deleteBtns = screen.getAllByDisplayValue("削除開始");
    fireEvent.click(deleteBtns[0]); // 1つ目の削除ボタン = 工数データ削除
    // 検証: 工数削除開始APIが送信データ付きで呼ばれる（URL の "delet" はサーバー側の定義どおりの綴り）
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/kosu_delet/", expect.any(Object));
    });
  });

  // 【テスト】バックアップ開始APIが通信に失敗したら通知ダイアログが出ること
  //   前提: POST は1回目に例外（Error）を投げる
  //   操作: 工数データの「バックアップ開始」をクリック
  //   期待: window.alert が呼ばれる（「〜の開始に失敗しました。」の通知）
  it("handles backup POST failure", async () => {
    // 準備: タスク開始APIを失敗させる
    mockedApi.post.mockRejectedValueOnce(new Error("network error"));
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 工数データの「バックアップ開始」（添字0）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[0]);
    // 検証: 失敗の通知ダイアログが出る
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  // 【テスト】バックアップ開始APIの応答に taskId が無ければ通知ダイアログが出ること
  //   前提: POST は taskId を含まず message「失敗しました」だけを返す（タスクが開始されなかった扱い）
  //   操作: 工数データの「バックアップ開始」をクリック
  //   期待: window.alert が呼ばれる（応答の message の通知）
  it("handles backup response without taskId", async () => {
    // 準備: タスク開始APIが taskId 無しの応答を返すようにする
    mockedApi.post.mockResolvedValue({ data: { message: "失敗しました" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 工数データの「バックアップ開始」（添字0）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[0]);
    // 検証: 通知ダイアログが出る
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  // 【テスト】人員データの「バックアップ開始」で人員バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 4つ目（人員データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/member_backup/" と undefined（送信データ無し）で呼ばれる
  it("starts member backup", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "mem123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/member.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    // 操作: 人員データは4つ目（添字3）のバックアップボタン（工数・工数区分定義・作業詳細選択肢・人員の順）
    fireEvent.click(backupBtns[3]);
    // 検証: 人員バックアップ開始APIが送信データ無しで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/member_backup/", undefined);
    });
  });

  // 【テスト】班員データの「バックアップ開始」で班員バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 5つ目（班員データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/team_backup/" と undefined（送信データ無し）で呼ばれる
  it("starts team backup", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "team123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/team.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    // 操作: 班員データは5つ目（添字4）のバックアップボタン
    fireEvent.click(backupBtns[4]);
    // 検証: 班員バックアップ開始APIが送信データ無しで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_backup/", undefined);
    });
  });

  // 【テスト】問い合わせデータの「バックアップ開始」で問い合わせバックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 6つ目（問い合わせデータ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/inquiry_backup/" と undefined（送信データ無し）で呼ばれる
  it("starts inquiry backup", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "inq123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/inquiry.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 問い合わせデータの「バックアップ開始」（添字5）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[5]); // 問い合わせデータのバックアップ
    // 検証: 問い合わせバックアップ開始APIが送信データ無しで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/inquiry_backup/", undefined);
    });
  });

  // 【テスト】設定データの「バックアップ開始」で設定バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 7つ目（設定データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/setting_backup/" と undefined（送信データ無し）で呼ばれる
  it("starts setting backup", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "set123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/setting.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 設定データの「バックアップ開始」（添字6）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[6]); // 設定データのバックアップ
    // 検証: 設定バックアップ開始APIが送信データ無しで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/setting_backup/", undefined);
    });
  });

  // 【テスト】タスク履歴データの「バックアップ開始」で非同期タスク履歴のバックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 8つ目（タスク履歴データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/AsyncTask_backup/" と送信データ（期間指定の開始日・終了日）付きで呼ばれる
  it("starts async task backup (date-ranged)", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "async123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/async.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: タスク履歴データの「バックアップ開始」（添字7）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[7]); // タスク履歴（非同期タスク）のバックアップ
    // 検証: タスク履歴バックアップ開始APIが送信データ付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/AsyncTask_backup/", expect.any(Object));
    });
  });

  // 【テスト】操作履歴データの「バックアップ開始」で操作履歴バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 9つ目（操作履歴データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/History_backup/" と送信データ（期間指定の開始日・終了日）付きで呼ばれる
  it("starts history backup (date-ranged)", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "hist123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/history.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 操作履歴データの「バックアップ開始」（添字8）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[8]); // 操作履歴のバックアップ
    // 検証: 操作履歴バックアップ開始APIが送信データ付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/History_backup/", expect.any(Object));
    });
  });

  // 【テスト】タスク履歴データの「削除開始」で非同期タスク履歴の削除開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 2つ目（タスク履歴データ）の「削除開始」をクリック
  //   期待: api.post が "/api/AsyncTask_delet/" と送信データ（期間指定の開始日・終了日）付きで呼ばれる
  it("starts async task delete", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "asyncDel" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: タスク履歴データの「削除開始」（添字1）をクリック
    const deleteBtns = screen.getAllByDisplayValue("削除開始");
    fireEvent.click(deleteBtns[1]); // タスク履歴（非同期タスク）の削除
    // 検証: タスク履歴削除開始APIが送信データ付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/AsyncTask_delet/", expect.any(Object));
    });
  });

  // 【テスト】操作履歴データの「削除開始」で操作履歴削除開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 3つ目（操作履歴データ）の「削除開始」をクリック
  //   期待: api.post が "/api/History_delet/" と送信データ（期間指定の開始日・終了日）付きで呼ばれる
  it("starts history delete", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "histDel" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 操作履歴データの「削除開始」（添字2）をクリック
    const deleteBtns = screen.getAllByDisplayValue("削除開始");
    fireEvent.click(deleteBtns[2]); // 操作履歴の削除
    // 検証: 操作履歴削除開始APIが送信データ付きで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/History_delet/", expect.any(Object));
    });
  });

  // 【テスト】作業詳細選択肢データの「バックアップ開始」で選択肢バックアップ開始APIが呼ばれること
  //   前提: POST は taskId を返す、2回目以降の GET（タスク状態確認）は success を返す
  //   操作: 3つ目（作業詳細選択肢データ）の「バックアップ開始」をクリック
  //   期待: api.post が "/api/choice_backup/" と undefined（送信データ無し）で呼ばれる
  it("starts choice backup", async () => {
    // 準備: タスク開始APIは taskId を返す
    mockedApi.post.mockResolvedValue({ data: { taskId: "choice123" } });
    // 準備: 1回目の GET（権限チェック）は空データ、それ以降（タスク状態確認）は「完了」を返す
    mockedApi.get
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValue({ data: { status: "success", file_path: "/choice.csv" } });
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 操作: 作業詳細選択肢データの「バックアップ開始」（添字2）をクリック
    const backupBtns = screen.getAllByDisplayValue("バックアップ開始");
    fireEvent.click(backupBtns[2]); // 作業詳細選択肢データのバックアップ
    // 検証: 選択肢バックアップ開始APIが送信データ無しで呼ばれる
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/choice_backup/", undefined);
    });
  });

  // 【テスト】権限チェックAPIが401/403以外のエラーでも画面が表示されること
  //   前提: 権限チェックAPIは status 500・message「Server Error」のエラーを返す
  //   操作: 画面を表示する
  //   期待: 画面タイトル「データ管理」が表示される（画面が落ちない）
  it("shows error when other error during auth check", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500 },
      message: "Server Error",
    });
    // 操作: 画面を表示
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    // 検証: 画面タイトルが表示されるまで待つ（見つからなければ findByText が失敗する）
    await screen.findByText("データ管理");
    // 画面が落ちないことだけを確認している。エラー内容は画面内部の state に保存される
    // （エラーメッセージの表示内容までは確認していない）
  });

  // 【テスト】ファイル未選択の状態では「ロード開始」ボタンがすべて押せないこと
  //   前提: 初期表示が完了している（どのデータ欄でもファイルを選んでいない）
  //   操作: 画面を表示する
  //   期待: 「ロード開始」ボタンがすべて無効（disabled）になっている
  it("displays all load buttons as disabled when no file selected", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: 全「ロード開始」ボタンが1つずつ無効状態である
    const loadBtns = screen.getAllByDisplayValue("ロード開始");
    loadBtns.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  // 【テスト】ファイル選択欄に初期文言が表示されること
  //   前提: 初期表示が完了している（ファイル未選択）
  //   操作: 画面を表示する
  //   期待: 「ファイルを選択 (CSV/XLSX)」が1個以上表示される
  it("displays file upload labels with default text", async () => {
    // 準備: 画面を表示し、権限チェックが終わるのを待つ
    render(<MemoryRouter><AdministratorLoading /></MemoryRouter>);
    await screen.findByText("データ管理");
    // 検証: ファイル未選択時の文言が出ている（データ種別ごとに複数あるため getAll で数える）
    const fileLabels = screen.getAllByText("ファイルを選択 (CSV/XLSX)");
    expect(fileLabels.length).toBeGreaterThan(0);
  });
});
