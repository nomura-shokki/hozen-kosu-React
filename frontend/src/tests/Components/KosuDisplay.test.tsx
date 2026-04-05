import { vi, describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import KosuDisplay from "../../Components/KosuDisplay";

describe("KosuDisplay", () => {
  const baseProps = {
    timeWork: "A".repeat(288),
    workDetail: Array(288).fill("detail").join("$"),
    updatedAt: new Date("2025-01-01"),
    defData: { kosu_title_1: "作業A" } as { [key: string]: string | undefined },
    tyoku: "1",
    shop: "W1",
  };

  it("renders table headers", () => {
    render(<KosuDisplay {...baseProps} />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
    expect(screen.getByText("作業内容")).toBeInTheDocument();
    expect(screen.getByText("作業詳細")).toBeInTheDocument();
  });

  it("renders with headerColor prop", () => {
    render(<KosuDisplay {...baseProps} headerColor="#ff0000" />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveStyle({ backgroundColor: "#ff0000" });
  });

  it("renders parsed data rows for tyoku 1", () => {
    render(<KosuDisplay {...baseProps} />);
    expect(screen.getByText("作業A")).toBeInTheDocument();
  });

  it("renders with tyoku 2 and W1 shop", () => {
    render(<KosuDisplay {...baseProps} tyoku="2" shop="W1" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with tyoku 2 and non-W shop", () => {
    render(<KosuDisplay {...baseProps} tyoku="2" shop="P" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with tyoku 3 and W2 shop", () => {
    render(<KosuDisplay {...baseProps} tyoku="3" shop="W2" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with tyoku 3 and non-W shop", () => {
    render(<KosuDisplay {...baseProps} tyoku="3" shop="P" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with tyoku 4", () => {
    render(<KosuDisplay {...baseProps} tyoku="4" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with tyoku 6", () => {
    render(<KosuDisplay {...baseProps} tyoku="6" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with unknown tyoku (default)", () => {
    render(<KosuDisplay {...baseProps} tyoku="9" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("handles break character ($) in timeWork", () => {
    const timeWork = "$".repeat(288);
    render(<KosuDisplay {...baseProps} timeWork={timeWork} />);
    expect(screen.getByText("休憩")).toBeInTheDocument();
  });

  it("handles hash character (#) in timeWork", () => {
    const timeWork = "A".repeat(50) + "#".repeat(238);
    render(<KosuDisplay {...baseProps} timeWork={timeWork} />);
    expect(screen.getByText("作業A")).toBeInTheDocument();
  });

  it("handles empty timeWork", () => {
    render(<KosuDisplay {...baseProps} timeWork="" workDetail="" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("responds to window resize", () => {
    render(<KosuDisplay {...baseProps} />);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with A1 shop for tyoku 2", () => {
    render(<KosuDisplay {...baseProps} tyoku="2" shop="A1" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with A2 shop for tyoku 3", () => {
    render(<KosuDisplay {...baseProps} tyoku="3" shop="A2" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with J shop for tyoku 2", () => {
    render(<KosuDisplay {...baseProps} tyoku="2" shop="J" />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });

  it("renders with multiple def data entries", () => {
    const defData = {
      kosu_title_1: "作業A",
      kosu_title_2: "作業B",
      kosu_title_3: "作業C",
    };
    const timeWork = "A".repeat(100) + "B".repeat(100) + "C".repeat(88);
    render(<KosuDisplay {...baseProps} defData={defData} timeWork={timeWork} />);
    expect(screen.getByText("作業時間")).toBeInTheDocument();
  });
});
