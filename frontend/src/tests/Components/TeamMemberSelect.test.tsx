import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import TeamMemberSelect from "../../Components/TeamMemberSelect";

describe("TeamMemberSelect Component", () => {
  const mockOnChange = vi.fn();

  const options = [
    { employee_no: 101, name: "田中太郎" },
    { employee_no: 202, name: "鈴木次郎" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("'-- 人員選択 --' とメンバーオプションが 'employee_no - name' 形式で表示されること", () => {
    render(
      <TeamMemberSelect name="member" value="" onChange={mockOnChange} options={options} />
    );
    expect(screen.getByText("-- 人員選択 --")).toBeInTheDocument();
    expect(screen.getByText("101 - 田中太郎")).toBeInTheDocument();
    expect(screen.getByText("202 - 鈴木次郎")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("空のoptions配列の場合、プレースホルダーのみ表示されること", () => {
    render(
      <TeamMemberSelect name="member" value="" onChange={mockOnChange} options={[]} />
    );
    expect(screen.getByText("-- 人員選択 --")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(
      <TeamMemberSelect name="member" value="" onChange={mockOnChange} options={options} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "101" } });
    expect(mockOnChange).toHaveBeenCalled();
  });
});
