import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import InquirUpdate from "../../InquirPage/InquirUpdate";

vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
import api from "../../api/axios";
const mockedApi = api as any;

vi.mock("axios", () => ({
  default: {
    isAxiosError: vi.fn((err) => !!err.response),
  },
}));

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    useParams: () => ({ id: "1" }),
  };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/ItemSelect", () => ({
  default: (props: any) => (
    <select data-testid="item-select" onChange={props.onChange} value={props.value}>
      <option value="">---</option>
      <option value="要望">要望</option>
    </select>
  ),
}));

describe("InquirUpdate Component", () => {
  const mockResponse = {
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
        authority: true,
        administrator: true,
      },
      inquir_member_data: {
        employee_no: 101,
        name: "太郎",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("フォームに問い合わせデータが表示されること", async () => {
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    expect(await screen.findByText("問い合わせ編集")).toBeInTheDocument();
    const inquiryTextarea = screen.getByLabelText("問い合わせ：");
    expect(inquiryTextarea).toHaveValue("テスト");
  });

  it("管理者の場合に回答テキストエリアが表示されること", async () => {
    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    expect(await screen.findByLabelText("回答：")).toBeInTheDocument();
    expect(screen.getByLabelText("回答：")).toHaveValue("回答");
  });

  it("編集ボタンクリックでPUTが呼ばれナビゲートすること", async () => {
    mockedApi.put.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    await screen.findByText("問い合わせ編集");
    fireEvent.click(screen.getByRole("button", { name: "編集" }));

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith(
        expect.stringContaining("/api/inquir_update/1/"),
        expect.any(Object)
      );
    });

    expect(window.alert).toHaveBeenCalledWith("登録完了！");
    expect(mockedNavigate).toHaveBeenCalledWith("/inquir-list");
  });

  it("削除ボタンクリックで確認OK時にDELETEが呼ばれナビゲートすること", async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    await screen.findByText("問い合わせ編集");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/inquir_update/1/")
      );
    });

    expect(window.alert).toHaveBeenCalledWith("削除が完了しました");
    expect(mockedNavigate).toHaveBeenCalledWith("/inquir-list");
  });

  it("非管理者の場合に回答テキストエリアが非表示であること", async () => {
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

    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    await screen.findByText("問い合わせ編集");
    expect(screen.queryByLabelText("回答：")).not.toBeInTheDocument();
  });

  it("削除確認ダイアログでキャンセル時にDELETEが呼ばれないこと", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <InquirUpdate />
      </MemoryRouter>
    );

    await screen.findByText("問い合わせ編集");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  it("401エラー時にログインにリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("403エラー時にメインにリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("ナビゲーションリンクが表示されること", async () => {
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    expect(screen.getByText("問い合わせ履歴")).toBeInTheDocument();
  });

  it("内容選択セレクトが表示されること", async () => {
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    expect(screen.getByTestId("item-select")).toBeInTheDocument();
  });

  it("問い合わせテキストの変更が反映されること", async () => {
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    const textarea = screen.getByLabelText("問い合わせ：");
    fireEvent.change(textarea, { target: { name: "inquiry", value: "新しいテスト" } });
    expect(textarea).toHaveValue("新しいテスト");
  });

  it("サーバーエラーメッセージが表示されること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 500, data: { message: "サーバーエラー" } },
    });
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    expect(await screen.findByText("Error: サーバーエラー")).toBeInTheDocument();
  });

  it("非Axiosエラー時にエラーメッセージが表示されること", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("unknown"));
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    expect(await screen.findByText("Error: 不明なエラーが発生しました。IT担当者に連絡してください。")).toBeInTheDocument();
  });

  it("内容選択の変更ハンドラが動作すること", async () => {
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    const select = screen.getByTestId("item-select");
    fireEvent.change(select, { target: { value: "要望" } });
    expect(select).toHaveValue("要望");
  });

  it("PUT失敗時の401エラーでリダイレクトすること", async () => {
    mockedApi.put.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("DELETE失敗時の401エラーでリダイレクトすること", async () => {
    mockedApi.delete.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><InquirUpdate /></MemoryRouter>);
    await screen.findByText("問い合わせ編集");
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
