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
    <div>
      <table>
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