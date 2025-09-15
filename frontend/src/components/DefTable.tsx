import React from "react";
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

  return (
    <div className={styles.chartDataList}>
      {titles.map((item, index) => (
        <div key={index} className={styles.dataListItem}>
          <span className={styles.itemLabel}>{item.title}</span>
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
        </div>
      ))}
    </div>
  );
};

export default DefTable;