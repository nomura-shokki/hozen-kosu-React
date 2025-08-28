import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/components/KosuDisplay.module.css";

interface KosuDisplayProps {
  timeWork: string; 
  workDetail: string;
  updatedAt: Date;
  defData: { [key: string]: string | undefined };
  tyoku: string;
  shop: string;
}

const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, workDetail, updatedAt, defData, tyoku, shop }) => {
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const parseTimeWorkAndDetail = () => {
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .reduce((acc, key, index) => {
          acc["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"[index]] = defData[key] ?? null;
          return acc;
        }, {} as Record<string, string | null>);

      const adjustRange = (start: number, end: number) => ({
        adjustedTimeWork: timeWork.repeat(2).slice(start, timeWork.length * 2 - end),
        splitDetails: workDetail.split("$").concat(workDetail.split("$")).slice(start, workDetail.split("$").length * 2 - end)
      });

      const ranges: Record<string, { start: number; end: number }> = {
        "1": { start: 54, end: 234 },
        "2W_A": { start: 106, end: 182 },
        "2": { start: 140, end: 148 },
        "3W_A": { start: 214, end: 74 },
        "3": { start: 242, end: 46 },
        "4": { start: 72, end: 216 },
        "6": { start: 182, end: 106 },
      };
      const rangeKey = tyoku + ((tyoku === "2" || tyoku === "3") && (["W1", "W2", "A1", "A2", "J", "組長以上(W,A)"].includes(shop)) ? "W_A" : "");

      const { adjustedTimeWork, splitDetails } = ranges[rangeKey]
        ? adjustRange(ranges[rangeKey].start, ranges[rangeKey].end)
        : { adjustedTimeWork: timeWork, splitDetails: workDetail.split("$") };

      const result: { time: string; work: string; detail: string }[] = [];    
      let currentWork = "", currentDetail = "", startIndex = -1;

      // セッション終了または状態変化の処理
      const pushResult = (i: number, offset: number) => {
        if (currentWork || currentDetail) {
          const startHour = Math.floor((startIndex + offset) / 12) % 24;
          const startMinute = ((startIndex + offset) % 12) * 5;
          const endHour = Math.floor((i + offset) / 12) % 24;
          const endMinute = ((i + offset) % 12) * 5;
          const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
          result.push({ time: timeRange, work: currentWork, detail: currentDetail });
        }
      };

      for (let i = 0; i <= adjustedTimeWork.length; i++) {
        const charWork = adjustedTimeWork[i];
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork];
        const charDetail = splitDetails[Math.floor(i / (adjustedTimeWork.length / splitDetails.length))] ?? "";

        // `#` のみによるセッション終了
        if (charWork === "#" || charWork === undefined) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          // 作業内容や詳細の変化
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = mappedWork || charWork;
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      return result;
    };

    setParsedData(parseTimeWorkAndDetail());
  }, [timeWork, workDetail, updatedAt, defData, tyoku]);

  useEffect(() => {
    const updateMaxHeight = () => setMaxHeight(window.innerHeight);
    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
    };
    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [parsedData]);

  return (
    <div className={styles["table-wrapper"]} style={{ maxHeight: `${maxHeight}px`, overflowY: "auto", width: `${tableWidth + 5}px` }}>
      <table ref={tableRef}>
        <thead>
          <tr>
            <th className={styles["th-collar"]}>作業時間</th>
            <th className={styles["th-collar"]}>作業内容</th>
            <th className={styles["th-collar"]}>作業詳細</th>
          </tr>
        </thead>
        <tbody>
          {parsedData.map((item, index) => (
            <tr key={index}>
              <td>{item.time}</td>
              <td>{item.work}</td>
              <td>{item.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default KosuDisplay;