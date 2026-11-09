/**
 * ============================================================
 * ファイル名 : InquirUpdate.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : InquirPage/InquirUpdate.tsx（問い合わせ編集画面）
 * 概要       : 取得した問い合わせデータのフォームへの反映・管理者だけに出る回答欄・
 *              「編集」ボタンでの PUT 送信・「削除」ボタンでの確認ダイアログと DELETE 送信・
 *              表示時/送信時のエラー（401/403/500/通信以外）の挙動・入力変更の反映を確認する。
 *
 * モック方針 :
 *   - api（../../api/axios）      : 実際のサーバー通信をさせず、返す値をテストごとに指定するため
 *   - axios.isAxiosError           : 「response を持つエラー」を通信エラーとして扱わせるため
 *   - react-router-dom の useNavigate / useParams : 画面遷移先の確認と URL の :id を "1" に固定するため
 *   - Loading / ItemSelect         : 画面の本質と関係ない子部品を単純化するため
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
import InquirUpdate from "../../InquirPage/InquirUpdate";

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
    // URL の :id（編集対象の問い合わせのID）を "1" に固定する
    useParams: () => ({ id: "1" }),
  };
});

// 子コンポーネントのモック
// Loading: 何も表示しない
vi.mock("../../Components/Loading", () => ({ default: () => null }));
// ItemSelect（内容の種類のプルダウン）: 選択肢「---」と「要望」の2つだけを持つ簡易版にする
// （value と onChange は本物の画面から受け取るため、選択値は画面側の state に連動する）
vi.mock("../../Components/ItemSelect", () => ({
  default: (props: any) => (
    <select data-testid="item-select" onChange={props.onChange} value={props.value}>
      <option value="">---</option>
      <option value="要望">要望</option>
    </select>
  ),
}));

// ============================================================
// テスト本体
// ============================================================

// InquirUpdate 画面の表示・編集送信・削除・エラー処理をまとめて確認するテストグループ
describe("InquirUpdate Component", () => {
  // GET /api/inquir_update/1/ のレスポンス例（ログイン者は管理者）
  const mockResponse = {
    data: {
      // 編集対象の問い合わせデータ
      inquir_data: {
        employee_no2: 101, // 問い合わせ者の従業員番号
        content_choice: "要望", // 内容の種類
        inquiry: "テスト", // 問い合わせ本文
        answer: "回答", // 回答
      },
      // ログイン者の人員データ（administrator が true のときだけ回答欄が表示される）
      login_data: {
        employee_no: 101,
        name: "太郎",
        shop: "P",
        authority: true,
        administrator: true,
      },
      // 問い合わせ者の人員データ（この画面では使われない）
      inquir_member_data: {
        employee_no: 101,
        name: "太郎",
      },
    },
  };

  // 各テストの前に: モックの呼び出し履歴を消し、ダイアログとAPIの既定の振る舞いを設定する
  beforeEach(() => {
    vi.clearAllMocks();
    // 削除確認ダイアログは既定で「OK」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // 完了メッセージのダイアログは表示せず、呼ばれたかどうかだけを記録する
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // データ取得APIは常に上の mockResponse を返す
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  // 【テスト】見出しが表示され、問い合わせ本文がフォームの初期値として入ること
  //   前提: APIは問い合わせ本文「テスト」のデータを返す
  //   操作: 画面を表示する
  //   期待: 見出し「問い合わせ編集」が表示され、問い合わせ欄の値が「テスト」である
  it("フォームに問い合わせデータが表示されること", async () => {
    // 操作: 画面を表示（useNavigate や Link を使うため MemoryRouter で包む）
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    // 検証: 読み込み完了後に見出しが表示される
    expect(await screen.findByText("問い合わせ編集")).toBeInTheDocument();
    // 検証: ラベル「問い合わせ：」に紐づくテキストエリアに取得データが入っている
    const inquiryTextarea = screen.getByLabelText("問い合わせ：");
    expect(inquiryTextarea).toHaveValue("テスト");
  });

  // 【テスト】ログイン者が管理者の場合、回答欄が表示され、回答が初期値として入ること
  //   前提: ログイン者は管理者（administrator: true）、回答は「回答」
  //   操作: 画面を表示する
  //   期待: ラベル「回答：」のテキストエリアがあり、値が「回答」である
  it("管理者の場合に回答テキストエリアが表示されること", async () => {
    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    // 検証: 回答欄が表示される（読み込み完了を待って確認）
    expect(await screen.findByLabelText("回答：")).toBeInTheDocument();
    // 検証: 回答欄の値が取得データと一致する
    expect(screen.getByLabelText("回答：")).toHaveValue("回答");
  });

  // 【テスト】「編集」ボタンで PUT が送られ、完了表示の後に問い合わせ履歴へ遷移すること
  //   前提: 更新APIは成功を返す
  //   操作: 「編集」ボタン（フォームの送信ボタン）をクリック
  //   期待: api.put が /api/inquir_update/1/ と送信データ付きで呼ばれ、
  //         「登録完了！」の表示後に /inquir-list へ遷移する
  it("編集ボタンクリックでPUTが呼ばれナビゲートすること", async () => {
    // 準備: 1回目の更新APIを成功させる
    mockedApi.put.mockResolvedValueOnce({ data: {} });

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    // 準備: 読み込み完了（見出しの表示）を待つ
    await screen.findByText("問い合わせ編集");
    // 操作: 「編集」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "編集" }));

    // 検証: 編集対象ID（1）を含むURLに、フォームの内容（オブジェクト）付きで PUT が呼ばれる
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith(
        expect.stringContaining("/api/inquir_update/1/"),
        expect.any(Object)
      );
    });

    // 検証: 完了メッセージが表示され、問い合わせ履歴（/inquir-list）へ遷移する
    expect(window.alert).toHaveBeenCalledWith("登録完了！");
    expect(mockedNavigate).toHaveBeenCalledWith("/inquir-list");
  });

  // 【テスト】削除確認でOKを押すと DELETE が送られ、完了表示の後に問い合わせ履歴へ遷移すること
  //   前提: 確認ダイアログはOK、削除APIは成功を返す
  //   操作: 「削除」ボタンをクリック
  //   期待: api.delete が /api/inquir_update/1/ で呼ばれ、「削除が完了しました」の表示後に /inquir-list へ遷移する
  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    // 準備: 1回目の削除APIを成功させる
    mockedApi.delete.mockResolvedValueOnce({});

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    // 準備: 読み込み完了を待つ
    await screen.findByText("問い合わせ編集");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: 編集と同じURL（/api/inquir_update/1/）に DELETE が呼ばれる
    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/inquir_update/1/")
      );
    });

    // 検証: 完了メッセージが表示され、問い合わせ履歴（/inquir-list）へ遷移する
    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/inquir-list");
  });

  // 【テスト】ログイン者が管理者でない場合、回答欄が表示されないこと
  //   前提: ログイン者は administrator: false（問い合わせ者本人）
  //   操作: 画面を表示する
  //   期待: ラベル「回答：」の入力欄が存在しない
  it("非管理者の場合に回答テキストエリアが非表示であること", async () => {
    // 準備: 1回目のAPIで、ログイン者が管理者ではないデータを返す
    mockedApi.get.mockResolvedValueOnce({
      data: {
        inquir_data: {
          employee_no2: 101,
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
        inquir_member_data: { employee_no: 101, name: "太郎" },
      },
    });

    // 操作: 画面を表示
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    // 準備: 読み込み完了を待つ
    await screen.findByText("問い合わせ編集");
    // 検証: 回答欄はない（queryBy は見つからないと null を返すため非表示の確認に使う）
    expect(screen.queryByLabelText("回答：")).not.toBeInTheDocument();
  });

  // 【テスト】削除確認でキャンセルを押すと DELETE が送られないこと
  //   前提: 確認ダイアログはキャンセル（false）を返す
  //   操作: 「削除」ボタンをクリック
  //   期待: api.delete が一度も呼ばれない
  it("削除確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    // 準備: このテストだけ確認ダイアログで「キャンセル」を押した扱いにする
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // 準備: 画面を表示
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    // 準備: 読み込み完了を待つ
    await screen.findByText("問い合わせ編集");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    // 検証: キャンセルしたので削除APIは呼ばれない
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  // 【テスト】データ取得APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: APIは1回目の呼び出しで status 401 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/login") が呼ばれる
  it("401エラー時にログインにリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 401 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    // 操作: 画面を表示
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】データ取得APIが403（権限なし）を返したらメインメニューへ遷移すること
  //   前提: APIは1回目の呼び出しで status 403 のエラーを返す
  //   操作: 画面を表示する
  //   期待: navigate("/") が呼ばれる
  it("403エラー時にメインにリダイレクトすること", async () => {
    // 準備: 1回目のAPI呼び出しを 403 エラーにする
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    // 操作: 画面を表示
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    // 検証: メインメニュー（"/"）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  // 【テスト】問い合わせ履歴へ戻るリンクが表示されること
  //   前提: APIは問い合わせデータを返す
  //   操作: 画面を表示する
  //   期待: 「問い合わせ履歴」のリンク文字が表示される
  it("ナビゲーションリンクが表示されること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    // 検証: ナビゲーション欄に問い合わせ履歴画面へのリンクがある
    expect(screen.getByText("問い合わせ履歴")).toBeInTheDocument();
  });

  // 【テスト】内容の種類を選ぶプルダウンが表示されること
  //   前提: APIは問い合わせデータを返す
  //   操作: 画面を表示する
  //   期待: data-testid="item-select" の要素（モックの ItemSelect）が存在する
  it("内容選択セレクトが表示されること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    // 検証: プルダウンが data-testid で見つかる
    expect(screen.getByTestId("item-select")).toBeInTheDocument();
  });

  // 【テスト】問い合わせ本文を書き換えると、入力欄の値に反映されること
  //   前提: 問い合わせ本文の初期値は「テスト」
  //   操作: 問い合わせ欄に「新しいテスト」を入力
  //   期待: 入力欄の値が「新しいテスト」になる
  it("問い合わせテキストの変更が反映されること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    // 操作: 問い合わせ欄を変更する（画面側は name 属性で更新する項目を判断するため name も渡す）
    const textarea = screen.getByLabelText("問い合わせ：");
    fireEvent.change(textarea, { target: { name: "inquiry", value: "新しいテスト" } });
    // 検証: state が更新され、入力欄の値が変わる
    expect(textarea).toHaveValue("新しいテスト");
  });

  // 【テスト】データ取得APIがサーバーエラー（401/403 以外）を返したら、そのメッセージを表示すること
  //   前提: APIは status 500・message="サーバーエラー" のエラーを返す
  //   操作: 画面を表示する
  //   期待: 「Error: サーバーエラー」が表示される
  it("サーバーエラーメッセージが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しを 500 エラーにする
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    // 操作: 画面を表示
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    // 検証: 画面全体がエラー表示（"Error: " + メッセージ）に置き換わる
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  // 【テスト】通信以外のエラー（response を持たないエラー）では固定のエラーメッセージを表示すること
  //   前提: データ取得APIは通常の Error（response なし）を投げる
  //   操作: 画面を表示する
  //   期待: 「Error: 不明なエラーが発生しました。IT担当者に連絡してください。」が表示される
  it("非Axiosエラー時にエラーメッセージが表示されること", async () => {
    // 準備: 1回目のAPI呼び出しで response を持たない Error を投げる（isAxiosError のモックは false を返す）
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    // 操作: 画面を表示
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    // 検証: 予期しないエラー用の固定メッセージが表示される
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  // 【テスト】内容の種類のプルダウンを操作しても値が正しく保たれること
  //   前提: 内容の種類の初期値は「要望」（mockResponse の content_choice）
  //   操作: プルダウンで「要望」を選ぶ
  //   期待: プルダウンの値が「要望」である
  //   ※初期値と同じ値を選んでいるため、値が「変わる」ことまでは確かめていない
  it("内容選択の変更ハンドラが動作すること", async () => {
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    // 操作: プルダウンの値を「要望」に変更する
    const select = screen.getByTestId("item-select");
    fireEvent.change(select, { target: { value: "要望" } });
    // 検証: 選択値が「要望」になっている
    expect(select).toHaveValue("要望");
  });

  // 【テスト】更新APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: データ取得は成功、更新APIは status 401 のエラーを返す
  //   操作: 「編集」ボタンをクリック
  //   期待: navigate("/login") が呼ばれる
  it("PUT失敗時の401エラーでリダイレクトすること", async () => {
    // 準備: 1回目の更新API呼び出しを 401 エラーにする
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    // 操作: 「編集」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // 【テスト】削除APIが401（未ログイン）を返したらログイン画面へ遷移すること
  //   前提: データ取得は成功、確認ダイアログはOK、削除APIは status 401 のエラーを返す
  //   操作: 「削除」ボタンをクリック
  //   期待: navigate("/login") が呼ばれる
  it("DELETE失敗時の401エラーでリダイレクトすること", async () => {
    // 準備: 1回目の削除API呼び出しを 401 エラーにする
    mockedApi.delete.mockRejectedValueOnce({ response: { status: 401 } });
    // 準備: 画面を表示し、読み込み完了を待つ
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    // 操作: 「削除」ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    // 検証: ログイン画面（/login）への遷移が呼ばれる
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
