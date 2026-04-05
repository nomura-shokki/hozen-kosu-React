import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import ItemSelect from "../../Components/ItemSelect";

describe("ItemSelect Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全ての選択肢が表示されること", () => {
    render(<ItemSelect value="" onChange={mockOnChange} />);
    const expectedLabels = ["-- 内容選択 --", "要望", "不具合", "問い合わせ"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(<ItemSelect value="" onChange={mockOnChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "要望" } });
    expect(mockOnChange).toHaveBeenCalled();
  });
});
