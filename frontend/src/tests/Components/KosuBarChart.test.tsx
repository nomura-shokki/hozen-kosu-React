import { vi, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("react-chartjs-2", () => ({
  Bar: (props: any) => <canvas data-testid="bar-chart" data-labels={JSON.stringify(props.data?.labels?.length)} data-data={JSON.stringify(props.data?.datasets?.[0]?.data?.length)} />,
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
}));

import KosuBarChart from "../../Components/KosuBarChart";

describe("KosuBarChart", () => {
  it("renders a Bar chart with valid data for tyoku 1", () => {
    const timeWork = "A".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="1" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with null initialTimeWork", () => {
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={null} tyoku="1" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 2 and W1 shop", () => {
    const timeWork = "B".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 2 and non-W shop", () => {
    const timeWork = "C".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="P" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 3 and W2 shop", () => {
    const timeWork = "D".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="3" shop="W2" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 3 and non-W shop", () => {
    const timeWork = "E".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="3" shop="P" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 4", () => {
    const timeWork = "F".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="4" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 5", () => {
    const timeWork = "G".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="5" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with tyoku 6", () => {
    const timeWork = "H".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="6" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with unknown tyoku (default labels)", () => {
    const timeWork = "A".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="9" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("handles mixed characters including lowercase", () => {
    const timeWork = "AaBbCc" + "#".repeat(282);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="1" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("handles all-hash (empty) data", () => {
    const timeWork = "#".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="1" shop="W1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with A1 shop for tyoku 2", () => {
    const timeWork = "A".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="A1" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with A2 shop for tyoku 3", () => {
    const timeWork = "A".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="3" shop="A2" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with J shop for tyoku 2", () => {
    const timeWork = "A".repeat(288);
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="J" />
    );
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });
});
