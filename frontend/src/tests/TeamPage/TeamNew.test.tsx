import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from "../../api/axios";
const mockedApi = api as any;

vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn((err: any) => !!err.response) },
}));

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option></select> }));
vi.mock("../../Components/ShopSelect", () => ({ default: (props: any) => <select data-testid="shop-select" onChange={props.onChange}><option value="">---</option></select> }));

import TeamNew from "../../TeamPage/TeamNew";

const mockResponse = {
  data: {
    member_select: [
      { employee_no: 1, name: "山田", shop: "W1" },
      { employee_no: 2, name: "佐藤", shop: "W2" },
    ],
    member_data: { employee_no: 1, shop: "W1" },
    member_default: [{ employee_no: 1 }],
    team_data: { follow: false },
  },
};

describe("TeamNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    expect(await screen.findByText("班員登録")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_new/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("submits form via POST", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><TeamNew /></MemoryRouter>);
    await screen.findByText("班員登録");
    const submitBtn = screen.getByRole("button", { name: "登録" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/team_new/", expect.any(Object));
    });
  });
});
