import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import ContentSelect from "../../Components/ContentSelect";

describe("ContentSelect Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全ての選択肢が表示されること", () => {
    render(<ContentSelect value="" onChange={mockOnChange} />);
    const expectedLabels = ["---", "要望", "不具合", "問い合わせ"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(<ContentSelect value="" onChange={mockOnChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "要望" } });
    expect(mockOnChange).toHaveBeenCalled();
  });
});
