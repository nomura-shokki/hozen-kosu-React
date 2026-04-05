import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import DefMenu from "../../DefinitionPage/DefMenu";

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

describe("DefMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("工数区分定義MENUの見出しが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { employee_no: 1, name: "太郎", shop: "P", authority: true, administrator: true },
    });

    render(
      <MemoryRouter>
        <DefMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数区分定義MENU")).toBeInTheDocument();
  });

  it("管理者の場合に管理者専用リンクが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { employee_no: 1, name: "太郎", shop: "P", authority: true, administrator: true },
    });

    render(
      <MemoryRouter>
        <DefMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数区分定義登録")).toBeInTheDocument();
    expect(screen.getByText("工数区分定義一覧")).toBeInTheDocument();
    expect(screen.getByText("作業詳細選択肢登録")).toBeInTheDocument();
    expect(screen.getByText("作業詳細選択肢一覧")).toBeInTheDocument();
  });

  it("管理者でない場合に管理者専用リンクが非表示であること", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { employee_no: 1, name: "太郎", shop: "P", authority: true, administrator: false },
    });

    render(
      <MemoryRouter>
        <DefMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("工数区分定義確認")).toBeInTheDocument();
    expect(screen.queryByText("工数区分定義登録")).not.toBeInTheDocument();
    expect(screen.queryByText("工数区分定義一覧")).not.toBeInTheDocument();
  });
});
