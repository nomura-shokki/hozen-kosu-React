import { render, screen, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import Loading from "../../Components/Loading";

vi.mock("../../img/helmet.png", () => ({ default: "helmet.png" }));

vi.mock("../../styles/Components/Loading.module.css", () => ({
  default: {
    loading: "loading",
    fadeOut: "fadeOut",
    item: "item",
    sway: "sway",
    loadingText: "loadingText",
  },
}));

describe("Loading Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isLoading=true のとき Loading... テキストが表示されること", () => {
    render(<Loading isLoading={true} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("isLoading=false のとき fadeOut クラスが付与されること", () => {
    render(<Loading isLoading={false} />);
    const loadingDiv = screen.getByText("Loading...").closest("#loading");
    expect(loadingDiv).toHaveClass("fadeOut");
  });

  it("isLoading=false のとき、タイムアウト後に null を返すこと", () => {
    vi.useFakeTimers();
    const { container } = render(<Loading isLoading={false} />);

    // fadeOut 中はまだ表示されている
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // 1000ms 経過後に完全に消える
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector("#loading")).toBeNull();

    vi.useRealTimers();
  });
});
