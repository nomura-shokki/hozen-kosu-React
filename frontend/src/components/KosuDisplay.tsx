import React, { useEffect, useState } from "react";

interface KosuDisplayProps {
  timeWork: string; // 288文字の文字列
  workDetail: string; // `$`を含む文字列
  updatedAt: Date;    // データの更新タイミング
}

const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, workDetail, updatedAt }) => {
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);

  useEffect(() => {
    const parseTimeWorkAndDetail = () => {
      const result: { time: string; work: string; detail: string }[] = [];
      let currentWork = "";
      let currentDetail = "";
      let startIndex = -1;

      const splitDetails = workDetail.split("$").map((detail, index) =>
        detail === "" ? "" : detail
      );

      for (let i = 0; i <= timeWork.length; i++) {
        const charWork = timeWork[i];
        const charDetail = splitDetails[Math.floor(i / (timeWork.length / splitDetails.length))] ?? "";

        // スキップする条件: `#`またはundefined
        if (charWork === "#" || charWork === undefined) {
          if (currentWork !== "" || currentDetail !== "") {
            const startHour = Math.floor((startIndex * 5) / 60);
            const startMinute = (startIndex * 5) % 60;
            const endHour = Math.floor((i * 5) / 60);
            const endMinute = (i * 5) % 60;

            const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            result.push({
              time: timeRange,
              work: currentWork === "$" ? "休憩" : currentWork,
              detail: currentDetail
            });
          }
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (charWork !== currentWork || charDetail !== currentDetail) {

          if (currentWork !== "" || currentDetail !== "") {
            const startHour = Math.floor((startIndex * 5) / 60);
            const startMinute = (startIndex * 5) % 60;
            const endHour = Math.floor((i * 5) / 60);
            const endMinute = (i * 5) % 60;

            const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            result.push({
              time: timeRange,
              work: currentWork === "$" ? "休憩" : currentWork,
              detail: currentDetail
            });
          }
          currentWork = charWork;
          currentDetail = charDetail;
          startIndex = i;
        }
      }

      return result;
    };

    setParsedData(parseTimeWorkAndDetail());
  }, [timeWork, workDetail, updatedAt]);

  return (
    <div>
      <h2>作業時間と内容</h2>
      <table>
        <thead>
          <tr>
            <th>作業時間</th>
            <th>作業内容</th>
            <th>作業詳細</th>
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
