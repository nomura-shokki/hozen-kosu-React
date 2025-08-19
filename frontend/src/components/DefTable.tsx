import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/components/DefTable.module.css";

interface DefDataProps {
  defData: { [key: string]: string | undefined };
}

const generateColorPalette = (): string[] => {
  const colors = [];
  const step = Math.floor(360 / 50);
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * step) % 360}, 70%, 50%)`);
  }
  return colors;
};

const DefTable: React.FC<DefDataProps> = ({ defData }) => {
  const colorPalette = generateColorPalette();

  const titles = Object.keys(defData)
    .filter((key) => key.startsWith("kosu_title_") && defData[key])
    .map((key, index) => ({
      title: defData[key]!,
      color: colorPalette[index],
    }));

  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブルの最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブルの幅
  const tableRef = useRef<HTMLTableElement>(null); // テーブル要素の参照

  // ウィンドウサイズ変更時に最大高さを更新
  useEffect(() => {
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight);
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // テーブルの幅を更新
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [titles]);

  return (
    <div
      className={styles["table-wrapper"]}
      style={{
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        width: `${tableWidth + 20}px`,
      }}
    >
      <table ref={tableRef}>
        <thead>
          <tr>
            <th className={styles["th-collar"]}>工数タイトル</th>
            <th className={styles["th-collar"]}>色</th>
          </tr>
        </thead>
        <tbody>
          {titles.map((item, index) => (
            <tr key={index}>
              <td>{item.title}</td>
              <td>
                <span
                  className={styles["color-dot"]}
                  style={{
                    backgroundColor: item.color,
                    display: "inline-block",
                    borderRadius: "50%",
                    width: "14px",
                    height: "14px",
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DefTable;