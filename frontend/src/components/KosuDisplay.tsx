import React, { useEffect, useState } from "react";

interface KosuDisplayProps {
  timeWork: string; // 288文字の文字列を受け取る
  updatedAt: Date; // データ更新時間
}

const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, updatedAt }) => {
  const [parsedData, setParsedData] = useState<{ time: string; work: string }[]>([]);

  useEffect(() => {
    // timeWorkを解析しリストを作成する
    const parseTimeWork = () => {
      const result: { time: string; work: string }[] = [];
      let currentWork = "";
      let currentStart = "";

      for (let i = 0; i < timeWork.length; i++) {
        const char = timeWork[i];
        const startHour = Math.floor((i * 5) / 60);
        const startMinute = (i * 5) % 60;
        const endHour = Math.floor(((i + 1) * 5) / 60);
        const endMinute = ((i + 1) * 5) % 60;
        const time = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

        if (char !== "#" && char !== currentWork) {
          if (currentWork) {
            result.push({ time: currentStart, work: currentWork });
          }
          currentWork = char;
          currentStart = time;
        }

        // 最後のデータを追加
        if (i === timeWork.length - 1 && currentWork) {
          result.push({ time: currentStart, work: currentWork });
        }
      }
      return result;
    };

    setParsedData(parseTimeWork());
  }, [timeWork, updatedAt]);

  return (
    <div>
      <h2>作業時間と内容</h2>
      <table>
        <thead>
          <tr>
            <th>作業時間</th>
            <th>作業内容</th>
          </tr>
        </thead>
        <tbody>
          {parsedData.map((item, index) => (
            <tr key={index}>
              <td>{item.time}</td>
              <td>{item.work}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default KosuDisplay;
