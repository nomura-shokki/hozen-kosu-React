import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import DefSelect from "../../Components/DefSelect";

describe("DefSelect Component", () => {
  const mockOnChange = vi.fn();

  const defData = {
    kosu_title_1: "組立",
    kosu_title_2: "検査",
    kosu_title_3: "",
    other_key: "無関係",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("--- デフォルトオプションと 休憩 オプションが表示されること", () => {
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} />);
    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("休憩")).toBeInTheDocument();
  });

  it("kosu_title_ で始まるキーのうち空でないもののみオプションとして表示されること", () => {
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} />);
    expect(screen.getByText("組立")).toBeInTheDocument();
    expect(screen.getByText("検査")).toBeInTheDocument();
    // 空のkosu_title_3は表示されない
    // other_keyも表示されない
    const options = screen.getAllByRole("option");
    // ---、組立、検査、休憩 の4つ
    expect(options).toHaveLength(4);
  });

  it("選択変更時に onChange が呼ばれること", () => {
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "A" } });
    expect(mockOnChange).toHaveBeenCalled();
  });

  it("空のdefDataの場合、---と休憩のみ表示されること", () => {
    render(<DefSelect value="" onChange={mockOnChange} defData={{}} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("休憩")).toBeInTheDocument();
  });

  it("disabled=trueの場合、セレクトが無効化されること", () => {
    render(<DefSelect value="" onChange={mockOnChange} defData={defData} disabled={true} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
