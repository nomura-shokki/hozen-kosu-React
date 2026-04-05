import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import ShopSelect from "../../Components/ShopSelect";

vi.mock("../../styles/Components/ShopSelect.module.css", () => ({
  default: { "form-width": "form-width" },
}));

describe("ShopSelect Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全ての選択肢が表示されること", () => {
    render(<ShopSelect value="" onChange={mockOnChange} />);
    const expectedLabels = [
      "---", "P", "R", "W1", "W2", "T1", "T2", "A1", "A2", "J",
      "その他", "組長以上(P,R,T,その他)", "組長以上(W,A)", "異動・退社",
    ];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(14);
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(<ShopSelect value="" onChange={mockOnChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "P" } });
    expect(mockOnChange).toHaveBeenCalled();
  });
});
