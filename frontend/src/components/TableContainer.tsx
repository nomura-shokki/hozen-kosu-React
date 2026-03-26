import React, { useState, useEffect, useRef, ReactNode } from "react";
import styles from "../styles/Components/TableContainer.module.css";

interface TableContainerProps {
    children: ReactNode;
    searchBarRef: React.RefObject<HTMLElement | null>;
    headerRef: React.RefObject<HTMLElement | null>;
    heightExpansion?: boolean;
}

const TableContainer: React.FC<TableContainerProps> = ({
    children,
    searchBarRef,
    headerRef,
    heightExpansion = false,
}) => {
    const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateDimensions = () => {
            const searchBarHeight = searchBarRef.current?.offsetHeight || 0;
            const headerHeight = headerRef.current?.offsetHeight || 0;

            if (heightExpansion) {
                setMaxHeight(window.innerHeight - 100);
            } else {
                setMaxHeight(
                    window.innerHeight - searchBarHeight - headerHeight - 40
                );
            }
        };

        updateDimensions();

        window.addEventListener("resize", updateDimensions);
        return () => {
            window.removeEventListener("resize", updateDimensions);
        };
    }, [searchBarRef, headerRef, heightExpansion]);

    return (
        <div
            ref={containerRef}
            className={styles["table-wrapper"]}
            style={{
                maxHeight: `${maxHeight}px`,
                overflowY: "auto",
                overflowX: "auto",
                width: "fit-content",
                maxWidth: "100%",
            }}
        >
            {children}
        </div>
    );
};

export default TableContainer;