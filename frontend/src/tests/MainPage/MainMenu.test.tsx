import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import MainMenu from "../../MainPage/MainMenu";

// 画像モック
vi.mock("../../img/MenuRogo.png", () => ({ default: "img.png" }));
vi.mock("../../img/Note.png", () => ({ default: "img.png" }));
vi.mock("../../img/Balance.png", () => ({ default: "img.png" }));
vi.mock("../../img/Personnel.png", () => ({ default: "img.png" }));
vi.mock("../../img/Team.png", () => ({ default: "img.png" }));
vi.mock("../../img/Mail.png", () => ({ default: "img.png" }));
vi.mock("../../img/Setting.png", () => ({ default: "img.png" }));

// コンポーネントモック
vi.mock("../../Components/LogConsole", () => ({
  default: () => <div data-testid="log-console">LogConsole</div>,
}));

// APIモック
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
  return { ...actual, useNavigate: () => mockedNavigate };
});

const mockResponseAuthority = {
  data: {
    login_data: {
      employee_no: 12345,
      name: "テスト太郎",
      shop: "P",
      authority: true,
      administrator: true,
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
    admin_data: {
      administrator_employee_no1: "12345",
      administrator_employee_no2: "",
      administrator_employee_no3: "",
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
  },
};

const mockResponseNoAuthority = {
  data: {
    login_data: {
      employee_no: 99999,
      name: "一般ユーザー",
      shop: "P",
      authority: false,
      administrator: false,
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
    admin_data: {
      administrator_employee_no1: "12345",
      administrator_employee_no2: "",
      administrator_employee_no3: "",
      pop_up1: "",
      pop_up_id1: "",
      pop_up2: "",
      pop_up_id2: "",
      pop_up3: "",
      pop_up_id3: "",
      pop_up4: "",
      pop_up_id4: "",
      pop_up5: "",
      pop_up_id5: "",
    },
  },
};

describe("MainMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("挨拶メッセージが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);

    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("こんにちは テスト太郎さん")).toBeInTheDocument();
  });

  it("authority=trueの場合、人員MENUと班員MENUが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);

    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("人員MENU")).toBeInTheDocument();
    expect(screen.getByText("班員MENU")).toBeInTheDocument();
  });

  it("administrator=trueの場合、管理者MENUが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);

    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("管理者MENU")).toBeInTheDocument();
  });

  it("authority=falseの場合、人員MENUと班員MENUが非表示であること", async () => {
    mockedApi.get.mockResolvedValueOnce(mockResponseNoAuthority);

    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    // データ読み込み完了を待つ
    await screen.findByText("こんにちは 一般ユーザーさん");

    expect(screen.queryByText("人員MENU")).not.toBeInTheDocument();
    expect(screen.queryByText("班員MENU")).not.toBeInTheDocument();
    expect(screen.queryByText("管理者MENU")).not.toBeInTheDocument();
  });

  it("ログアウトボタンでPOST /api/logout/ が呼ばれ /login へ遷移すること", async () => {
    mockedApi.get.mockResolvedValueOnce(mockResponseAuthority);
    mockedApi.post.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );

    await screen.findByText("こんにちは テスト太郎さん");

    const logoutButton = screen.getByRole("button", { name: "ログアウト" });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/logout/", {});
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
