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
vi.mock("../../Components/LogConsole", () => ({ default: () => <div data-testid="log-console">LogConsole</div> }));

import AdminUpdate from "../../AdministratorPage/AdministratorUpdate";

const mockResponse = {
  data: {
    admin_data: {
      menu_row: 20,
      administrator_employee_no1: 11111,
      administrator_employee_no2: null,
      administrator_employee_no3: null,
    },
    login_data: { employee_no: 11111, name: "管理者", shop: "W1", authority: true, administrator: true },
  },
};

describe("AdministratorUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    localStorage.clear();
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    expect(await screen.findByText("設定編集")).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/manager_update/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays form with loaded data", async () => {
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    expect(await screen.findByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("11111")).toBeInTheDocument();
  });

  it("submits form via PUT", async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    render(<MemoryRouter><AdminUpdate /></MemoryRouter>);
    await screen.findByText("設定編集");
    const submitBtn = screen.getByRole("button", { name: "編集" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/api/manager_update/", expect.any(Object));
    });
  });
});
