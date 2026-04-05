import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import DefVersionSelect from "../../Components/DefVersionSelect";

describe("DefVersionSelect Component", () => {
  const mockOnChange = vi.fn();

  const choices = [
    { id: 1, kosu_name: "Version1" },
    { id: 2, kosu_name: "Version2" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("--- と choices の選択肢が表示されること", () => {
    render(
      <DefVersionSelect choices={choices} selectedVersion="" onChange={mockOnChange} />
    );
    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("Version1")).toBeInTheDocument();
    expect(screen.getByText("Version2")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("choices が空のとき '選択肢が取得できません' が表示されること", () => {
    render(
      <DefVersionSelect choices={[]} selectedVersion="" onChange={mockOnChange} />
    );
    expect(screen.getByText("選択肢が取得できません")).toBeInTheDocument();
  });
});
