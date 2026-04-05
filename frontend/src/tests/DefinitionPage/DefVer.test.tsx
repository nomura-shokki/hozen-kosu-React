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
vi.mock("../../Components/DefVersionSelect", () => ({ default: (props: any) => <select data-testid="version-select" onChange={props.onChange}><option value="">---</option></select> }));

import DefVer from "../../DefinitionPage/DefVer";

const mockResponse = {
  data: {
    choices: [{ id: 1, kosu_name: "Ver1" }],
    current_version: "Ver1",
  },
};

describe("DefVer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    mockedApi.get.mockResolvedValue(mockResponse);
  });

  it("displays the heading", async () => {
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "工数区分定義切り替え" })).toBeInTheDocument();
  });

  it("loads data from API", async () => {
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/def_ver/");
    });
  });

  it("navigates to /login on 401 error", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("displays current version", async () => {
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    expect(await screen.findByText(/Ver1/)).toBeInTheDocument();
  });

  it("submits version change via POST", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><DefVer /></MemoryRouter>);
    await screen.findByRole("heading", { name: "工数区分定義切り替え" });
    const submitBtn = screen.getByRole("button", { name: "工数区分定義切り替え" });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/def_ver/", expect.any(Object));
    });
  });
});
