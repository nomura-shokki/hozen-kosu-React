import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import InquirMenu from "../../InquirPage/InquirMenu";

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

describe("InquirMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("問い合わせMENUの見出しとリンクが表示されること", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter>
        <InquirMenu />
      </MemoryRouter>
    );

    expect(await screen.findByText("問い合わせMENU")).toBeInTheDocument();
    expect(screen.getByText("問い合わせ")).toBeInTheDocument();
    expect(screen.getByText("問い合わせ履歴")).toBeInTheDocument();
  });

  it("401エラー時に/loginへリダイレクトすること", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <MemoryRouter>
        <InquirMenu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
