/**
 * ============================================================
 * ファイル名 : DefNew.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : DefinitionPage/DefNew.tsx（工数区分定義登録画面）
 * 概要       : 表示時の権限確認API・各入力欄の変更・登録確認ダイアログでのOK/キャンセル・
 *              POST送信・エラー時（401/403/500/通信以外）の挙動を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate : 画面遷移先を確認するため
 *   - Loading                      : 画面の本質と関係ない読み込み表示を消すため
 *   - window.alert / window.confirm : ブラウザのダイアログを出さず、OK/キャンセルの結果を指定するため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// テスト対象のコンポーネント（vi.mock は自動的にファイル先頭へ移動されるため、ここで読み込んでもモックが効く）
import DefNew from "../../DefinitionPage/DefNew";

// ============================================================
// テスト本体
// ============================================================

// DefNew 画面の表示・入力・登録送信・エラー処理をまとめて確認するテストグループ
describe("DefNew", () => {
  // 各テストの前に: モックの呼び出し履歴を消し、ダイアログとAPIの既定の振る舞いを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 登録完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // 登録確認ダイアログは既定で「OK」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // 表示時の権限確認APIは成功（中身は使われないため空オブジェクト）を返す
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  // 【テスト】画面の見出しが表示されること
  //   前提: 権限確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: 見出し「工数区分定義登録」が表示される
  it("displays the heading", async () => {
    // 操作: 画面を表示（useNavigate 等を使うため MemoryRouter で包む）
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("工数区分定義登録")).toBeInTheDocument();
  });

  // 【テスト】表示時に権限確認用のAPIが呼ばれること
  //   前提: 権限確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: api.get が "/api/def_new/" で呼ばれる
  it("loads auth check from API", async () => {
    // 操作: 画面を表示
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    // 検証: 権限確認APIがパラメータなしで呼ばれる
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_new/");
    });
  });

  // 【テスト】権限確認APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("navigates to /login on 401 error", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】「登録」ボタンで確認ダイアログが出て、OKなら POST で送信されること
  //   前提: 確認ダイアログはOK、登録APIは成功を返す
  //   操作: 「登録」ボタン（フォームの上部と下部に2つある）のうち1つ目をクリック
  //   期待: window.confirm が呼ばれ、api.post が "/api/def_new/" と送信データ付きで呼ばれる
  it("submits form via POST with confirm", async () => {
    // 準備: 登録APIを成功させる
    mockedApi.post.mockResolvedValue({ data: {} });
    // 準備: 画面を表示し、読み込み完了（見出しの表示）を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 「登録」ボタンは上下2か所にあるため全件取得し、1つ目をクリック
    const submitBtns = screen.getAllByRole("button", { name: "登録" });
    fireEvent.click(submitBtns[0]);
    // 検証: 確認ダイアログが表示され、OK後に工数区分1〜50をまとめたデータで POST が呼ばれる
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_new/", expect.any(Object));
    });
  });

  // 【テスト】確認ダイアログでキャンセルすると送信されないこと
  //   前提: 確認ダイアログはキャンセル（false）を返す
  //   操作: 1つ目の「登録」ボタンをクリック
  //   期待: api.post が一度も呼ばれない
  it("does not submit when confirm is cancelled", async () => {
    // 準備: このテストだけ確認ダイアログで「キャンセル」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(false);
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 1つ目の「登録」ボタンをクリック
    const submitBtns = screen.getAllByRole("button", { name: "登録" });
    fireEvent.click(submitBtns[0]);
    // 検証: キャンセルしたので登録APIは呼ばれない
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  // 【テスト】権限確認APIが403（管理者権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("navigates to / on 403 error", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】工数区分定義メニューへ戻るリンクが表示されること
  //   前提: 権限確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: 「工数区分定義MENU」のリンク文字が表示される
  it("displays navigation link", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 検証: ナビゲーション欄にメニュー画面へのリンクがある
    expect(screen.getByText("工数区分定義MENU")).toBeInTheDocument();
  });

  // 【テスト】定義Ver名の入力欄が表示されること
  //   前提: 権限確認APIは成功を返す
  //   操作: 画面を表示する
  //   期待: id="kosu_name" の入力欄が存在する
  it("displays kosu_name input", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 検証: 定義Ver名の入力欄が id で見つかる
    expect(document.getElementById("kosu_name")).toBeInTheDocument();
  });

  // 【テスト】定義Ver名の入力欄を変更すると値が反映されること
  //   前提: 初期値は空
  //   操作: 定義Ver名の入力欄（id="kosu_name"）に「テストVer」を入力
  //   期待: 入力欄の値が「テストVer」になる
  it("handles kosu_name change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 定義Ver名の入力欄を変更する（画面側は name 属性で更新する項目を判断するため name も渡す）
    const nameInput = document.getElementById("kosu_name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: "kosu_name", value: "テストVer" } });
    // 検証: state が更新され、入力欄の値が変わる
    expect(nameInput).toHaveValue("テストVer");
  });

  // 【テスト】工数区分ごとの入力欄（ブロック）が描画されること
  //   前提: 初期状態で工数区分1〜50の空の入力欄が用意される
  //   操作: 画面を表示する
  //   期待: 1番目の工数区分名の入力欄（id="kosu_title_1"）が存在する
  it("displays definition block inputs", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 検証: 1番目の工数区分名の入力欄が id で見つかる
    expect(document.getElementById("kosu_title_1")).toBeInTheDocument();
  });

  // 【テスト】工数区分名の入力欄を変更すると値が反映されること
  //   前提: 1番目の工数区分名の初期値は空
  //   操作: 1番目の工数区分名（id="kosu_title_1"）に「作業名テスト」を入力
  //   期待: 入力欄の値が「作業名テスト」になる
  it("handles definition title change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 1番目の工数区分名の入力欄を変更する
    const titleInput = document.getElementById("kosu_title_1") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "作業名テスト" } });
    // 検証: 入力欄の値が変わる
    expect(titleInput).toHaveValue("作業名テスト");
  });

  // 【テスト】登録APIがエラーを返したら、サーバーからのメッセージを画面に表示すること
  //   前提: 登録APIは status 500・message="登録エラー" のエラーを返す（確認ダイアログはOK）
  //   操作: 1つ目の「登録」ボタンをクリック
  //   期待: 「登録エラー」が表示される
  it("handles POST error with server message", async () => {
    // 準備: 1回目の登録API呼び出しを 500 エラーにする
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: "登録エラー" } },
    });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 1つ目の「登録」ボタンをクリック
    const submitBtns = screen.getAllByRole("button", { name: "登録" });
    fireEvent.click(submitBtns[0]);
    // 検証: 401/403 以外のエラーなので、サーバーのメッセージがフォーム上部に表示される
    expect(await screen.findByText("登録エラー")).toBeInTheDocument();
  });

  // 【テスト】通信以外のエラー（response を持たないエラー）では固定のエラーメッセージを表示すること
  //   前提: 権限確認APIは通常の Error（response なし）を投げる
  //   操作: 画面を表示する
  //   期待: 「不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("displays non-axios error message", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる（isAxiosError のモックは false を返す）
    mockedApi.get.mockRejectedValueOnce(new Error("network error"));
    // 操作: 画面を表示
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    // 検証: 予期しないエラー用の固定メッセージが表示される
    expect(await screen.findByText("不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】工数区分の「定義」欄を変更すると値が反映されること
  //   前提: 1番目の工数区分の定義は空
  //   操作: 1番目の工数区分の定義（id="kosu_division_1_1"）に「テスト定義」を入力
  //   期待: テキストエリアの値が「テスト定義」になる
  it("handles division1 textarea change", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 定義のテキストエリアを変更する
    // （画面上の id は「kosu_division_{工数区分の番号}_{1:定義 / 2:作業内容 / 3:変動固定}」の形式）
    const div1Input = document.getElementById("kosu_division_1_1") as HTMLTextAreaElement;
    fireEvent.change(div1Input, { target: { value: "テスト定義" } });
    // 検証: テキストエリアの値が変わる
    expect(div1Input).toHaveValue("テスト定義");
  });

  // 【テスト】変動/固定の切り替えスイッチ（チェックボックス）をクリックするとONになること
  //   前提: 1番目の工数区分の変動/固定は初期値 false（OFF）
  //   操作: 1番目の工数区分の変動/固定（id="kosu_division_1_3"）をクリック
  //   期待: チェックが入った状態になる
  it("handles checkbox change for division3", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><DefNew /></MemoryRouter>);
    await screen.findByText("工数区分定義登録");
    // 操作: 1番目の工数区分の変動/固定チェックボックスをクリック
    const checkbox = document.getElementById("kosu_division_1_3") as HTMLInputElement;
    fireEvent.click(checkbox);
    // 検証: OFF → ON に切り替わる
    expect(checkbox).toBeChecked();
  });
});
