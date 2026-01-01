import React, { useState, useEffect, useRef, ReactNode } from "react";
import styles from "../styles/Components/TableContainer.module.css";

interface TableContainerProps {
  children: ReactNode;
  searchBarSelector: string;
  headerSelector: string;
  heightExpansion?: boolean;
}

const TableContainer: React.FC<TableContainerProps> = ({ 
  children, 
  searchBarSelector, 
  headerSelector,
  heightExpansion = false
}) => {
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      const searchBarHeight = (document.querySelector(searchBarSelector) as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector(headerSelector) as HTMLElement)?.offsetHeight || 0;
      if (heightExpansion) {
        setMaxHeight(window.innerHeight - 100);
      } else {
        setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40);
      }

      const tableElement = containerRef.current?.querySelector("table");
      if (tableElement) {
        setTableWidth(tableElement.offsetWidth);
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => updateDimensions());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      resizeObserver.disconnect();
    };
  }, [children, searchBarSelector, headerSelector, heightExpansion]);

  return (
    <div
      ref={containerRef}
      className={styles["table-wrapper"]}
      style={{
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        width: tableWidth > 0 ? `${tableWidth + 20}px` : "auto",
      }}
    >
      {children}
    </div>
  );
};

export default TableContainer;