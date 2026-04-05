import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import JudgementSelect from "../../Components/JudgementSelect";

describe("JudgementSelect Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全ての選択肢が表示されること", () => {
    render(<JudgementSelect value="" onChange={mockOnChange} />);
    const expectedLabels = ["---", "OK", "NG"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(<JudgementSelect value="" onChange={mockOnChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "OK" } });
    expect(mockOnChange).toHaveBeenCalled();
  });
});
