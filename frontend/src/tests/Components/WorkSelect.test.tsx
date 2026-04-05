import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import WorkSelect from "../../Components/WorkSelect";

vi.mock("../../styles/Components/WorkSelect.module.css", () => ({
  default: { "form-width": "form-width" },
}));

describe("WorkSelect Component", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("デフォルト(LIMIT)モードで限定された選択肢が表示されること", () => {
    render(<WorkSelect id="work" value="" onChange={mockOnChange} />);
    const limitLabels = ["---", "出勤", "シフト出", "休出", "半前年休", "半後年休", "早退・遅刻"];
    limitLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(7);
  });

  it("ALL モードで全ての選択肢が表示されること", () => {
    render(<WorkSelect id="work" value="" onChange={mockOnChange} mode="ALL" />);
    const allLabels = [
      "---", "出勤", "シフト出", "休出", "半前年休", "半後年休", "早退・遅刻",
      "休日", "年休", "公休", "シフト休", "代休", "欠勤",
    ];
    allLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(13);
  });

  it("disabled=trueの場合、セレクトが無効化されること", () => {
    render(<WorkSelect id="work" value="" onChange={mockOnChange} disabled={true} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(<WorkSelect id="work" value="" onChange={mockOnChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "出勤" } });
    expect(mockOnChange).toHaveBeenCalled();
  });
});
