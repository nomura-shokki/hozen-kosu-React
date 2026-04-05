import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import DefTable from "../../Components/DefTable";

vi.mock("../../styles/Components/DefTable.module.css", () => ({
  default: {
    chartDataList: "chartDataList",
    dataListItem: "dataListItem",
    itemLabel: "itemLabel",
    "color-dot": "color-dot",
  },
}));

describe("DefTable Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kosu_title_ キーの非空ラベルが表示されること", () => {
    const defData = {
      kosu_title_1: "組立",
      kosu_title_2: "検査",
      kosu_title_3: "",
      other_key: "無関係",
    };
    render(<DefTable defData={defData} />);
    expect(screen.getByText("組立")).toBeInTheDocument();
    expect(screen.getByText("検査")).toBeInTheDocument();
  });

  it("kosu_title_ キーが存在しない場合は何も表示されないこと", () => {
    const defData = { other_key: "無関係" };
    const { container } = render(<DefTable defData={defData} />);
    const items = container.querySelectorAll(".dataListItem");
    expect(items).toHaveLength(0);
  });

  it("各タイトルにカラードットが表示されること", () => {
    const defData = {
      kosu_title_1: "組立",
      kosu_title_2: "検査",
    };
    const { container } = render(<DefTable defData={defData} />);
    const dots = container.querySelectorAll(".color-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveStyle({ borderRadius: "50%" });
  });
});
