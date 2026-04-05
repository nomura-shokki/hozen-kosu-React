import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  return { ...actual, useNavigate: () => mockedNavigate, useLocation: () => ({ pathname: "/team-list", state: null }) };
});

vi.mock("../../Components/Loading", () => ({ default: () => null }));
vi.mock("../../Components/TableContainer", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("../../Components/Pagination", () => ({ default: () => <div data-testid="pagination">Pagination</div> }));
vi.mock("../../Components/TeamMemberSelect", () => ({ default: (props: any) => <select data-testid="member-select" onChange={props.onChange}><option value="">---</option></select> }));

import TeamList from "../../TeamPage/TeamList";

const mockResponse = {
  data: {
    pagination_data: {
      results: [
        { id: 1, employee_no3: 12345, name: "", work_day2: "2025-01-01", tyoku2: "1", judgement: true },
      ],
      page_size: 20,
      count: 1,
    },
    team_member_select: [
      { id: 1, employee_no: 12345, name: "テスト太郎" },
    ],
  },
};

describe("TeamList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    expect(await screen.findByText("班員工数履歴")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/team_list/", expect.any(Object));
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays data in table", async () => {
    render(<MemoryRouter><TeamList /></MemoryRouter>);
    expect(await screen.findByText("テスト太郎")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});
