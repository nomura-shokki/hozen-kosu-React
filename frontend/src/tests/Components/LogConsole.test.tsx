import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import LogConsole from "../../Components/LogConsole";

vi.mock("../../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));
import api from "../../api/axios";
const mockedApi = api as any;

vi.mock("../../styles/Components/LogConsole.module.css", () => ({
  default: {
    consoleContainer: "consoleContainer",
    loading: "loading",
    error: "error",
    consoleOutput: "consoleOutput",
  },
}));

describe("LogConsole Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期表示時に 'Loading log...' が表示されること", () => {
    mockedApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<LogConsole />);
    expect(screen.getByText("Loading log...")).toBeInTheDocument();
  });

  it("データ取得後にログ内容が表示されること", async () => {
    mockedApi.get.mockResolvedValue({ data: { log_content: "test log content" } });
    render(<LogConsole />);
    await waitFor(() => {
      expect(screen.getByText("test log content")).toBeInTheDocument();
    });
  });

  it("データ取得失敗時にエラーメッセージが表示されること", async () => {
    mockedApi.get.mockRejectedValue(new Error("Network Error"));
    render(<LogConsole />);
    await waitFor(() => {
      expect(screen.getByText("ログの読み込みに失敗しました。")).toBeInTheDocument();
    });
  });
});
