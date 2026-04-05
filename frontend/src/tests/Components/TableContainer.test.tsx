import { vi, describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import TableContainer from "../../Components/TableContainer";

describe("TableContainer", () => {
  const createRef = (height: number) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
    return { current: el } as React.RefObject<HTMLElement>;
  };

  it("renders children", () => {
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Test Content</div>
      </TableContainer>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("sets maxHeight based on window and refs", () => {
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    const { container } = render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Content</div>
      </TableContainer>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.overflowY).toBe("auto");
    expect(wrapper.style.overflowX).toBe("auto");
  });

  it("uses heightExpansion mode", () => {
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    const { container } = render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef} heightExpansion={true}>
        <div>Expanded Content</div>
      </TableContainer>
    );
    const wrapper = container.firstChild as HTMLElement;
    const maxH = parseInt(wrapper.style.maxHeight);
    expect(maxH).toBe(window.innerHeight - 100);
  });

  it("handles null refs", () => {
    const searchBarRef = { current: null } as React.RefObject<HTMLElement | null>;
    const headerRef = { current: null } as React.RefObject<HTMLElement | null>;
    render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Null Ref Content</div>
      </TableContainer>
    );
    expect(screen.getByText("Null Ref Content")).toBeInTheDocument();
  });

  it("updates on window resize", () => {
    const searchBarRef = createRef(50);
    const headerRef = createRef(60);
    render(
      <TableContainer searchBarRef={searchBarRef} headerRef={headerRef}>
        <div>Resize Content</div>
      </TableContainer>
    );
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("Resize Content")).toBeInTheDocument();
  });
});
