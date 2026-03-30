import React from "react";
import styles from "../styles/Components/Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  buttonColor?: string;
  hoverColor?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  setCurrentPage,
  buttonColor = "#fff",
  hoverColor = "#fff",
}) => {
  const handleFirstPage = () => setCurrentPage(1);
  const handleLastPage = () => setCurrentPage(totalPages);
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div 
      className={styles["pagination"]}
      style={{ 
        "--btn-bg-color": buttonColor, 
        "--btn-hover-color": hoverColor 
      } as React.CSSProperties}
    >
      <button
        className={styles["prev-button"]}
        disabled={currentPage === 1}
        onClick={handleFirstPage}
      >
        最初
      </button>
      <button
        className={styles["prev-button"]}
        disabled={currentPage === 1}
        onClick={handlePreviousPage}
      >
        前
      </button>
      <span>
        {currentPage} / {totalPages}
      </span>
      <button
        className={styles["next-button"]}
        disabled={currentPage === totalPages}
        onClick={handleNextPage}
      >
        次
      </button>
      <button
        className={styles["next-button"]}
        disabled={currentPage === totalPages}
        onClick={handleLastPage}
      >
        最後
      </button>
    </div>
  );
};

export default Pagination;