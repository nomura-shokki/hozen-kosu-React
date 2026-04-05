import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import Pagination from "../../Components/Pagination";

vi.mock("../../styles/Components/Pagination.module.css", () => ({
  default: {
    pagination: "pagination",
    "prev-button": "prev-button",
    "next-button": "next-button",
  },
}));

describe("Pagination Component", () => {
  let setCurrentPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentPage = vi.fn();
  });

  it("現在のページと総ページ数が正しく表示されること", () => {
    render(<Pagination currentPage={3} totalPages={10} setCurrentPage={setCurrentPage} />);
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
  });

  it("currentPage=1 のとき 最初・前 ボタンが disabled になること", () => {
    render(<Pagination currentPage={1} totalPages={5} setCurrentPage={setCurrentPage} />);
    expect(screen.getByText("最初")).toBeDisabled();
    expect(screen.getByText("前")).toBeDisabled();
  });

  it("currentPage=totalPages のとき 次・最後 ボタンが disabled になること", () => {
    render(<Pagination currentPage={5} totalPages={5} setCurrentPage={setCurrentPage} />);
    expect(screen.getByText("次")).toBeDisabled();
    expect(screen.getByText("最後")).toBeDisabled();
  });

  it("次 ボタンをクリックすると setCurrentPage(currentPage+1) が呼ばれること", () => {
    render(<Pagination currentPage={2} totalPages={5} setCurrentPage={setCurrentPage} />);
    fireEvent.click(screen.getByText("次"));
    expect(setCurrentPage).toHaveBeenCalledWith(3);
  });

  it("最初 ボタンをクリックすると setCurrentPage(1) が呼ばれること", () => {
    render(<Pagination currentPage={3} totalPages={5} setCurrentPage={setCurrentPage} />);
    fireEvent.click(screen.getByText("最初"));
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it("最後 ボタンをクリックすると setCurrentPage(totalPages) が呼ばれること", () => {
    render(<Pagination currentPage={2} totalPages={5} setCurrentPage={setCurrentPage} />);
    fireEvent.click(screen.getByText("最後"));
    expect(setCurrentPage).toHaveBeenCalledWith(5);
  });

  it("前 ボタンをクリックすると setCurrentPage(currentPage-1) が呼ばれること", () => {
    render(<Pagination currentPage={3} totalPages={5} setCurrentPage={setCurrentPage} />);
    fireEvent.click(screen.getByText("前"));
    expect(setCurrentPage).toHaveBeenCalledWith(2);
  });

  it("disabled状態のボタンをクリックしてもsetCurrentPageが呼ばれないこと", () => {
    render(<Pagination currentPage={1} totalPages={1} setCurrentPage={setCurrentPage} />);
    fireEvent.click(screen.getByText("前"));
    fireEvent.click(screen.getByText("最初"));
    fireEvent.click(screen.getByText("次"));
    fireEvent.click(screen.getByText("最後"));
    expect(setCurrentPage).not.toHaveBeenCalled();
  });
});
