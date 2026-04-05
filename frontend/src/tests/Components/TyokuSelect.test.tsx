import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import TyokuSelect from "../../Components/TyokuSelect";

vi.mock("../../styles/Components/TyokuSelect.module.css", () => ({
  default: { "form-width": "form-width" },
}));

describe("TyokuSelect Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全ての選択肢が表示されること", () => {
    render(<TyokuSelect id="tyoku" value="" onChange={mockOnChange} />);
    const expectedLabels = ["---", "1直", "2直", "3直", "常昼", "1直(連2)", "2直(連2)"];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(7);
  });

  it("disabled プロパティが機能すること", () => {
    render(<TyokuSelect id="tyoku" value="" onChange={mockOnChange} disabled={true} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeDisabled();
  });
});
