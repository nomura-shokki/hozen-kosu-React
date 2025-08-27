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
  // 作業内容の解析結果を保持する状態変数
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);
  
  // テーブル幅高さを保持する状態変数。動的に画面サイズに対応。
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  // 作業内容と詳細を解析する初期化処理
  useEffect(() => {
    const parseTimeWorkAndDetail = () => {
      // 処理結果を格納する配列
      const result: { time: string; work: string; detail: string }[] = [];
      
      // 現在の解析中の作業内容、詳細、および開始インデックスを保持
      let currentWork = ""; // 現在の作業タイトル
      let currentDetail = ""; // 現在の作業詳細
      let startIndex = -1; // 現在のセッション開始位置（インデックス）

      // defDataの中から“kosu_title_”で始まるキーを抽出し、対応するアルファベットをマッピング
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_")) // キーが`kosu_title_`で始まる場合に抽出
        .reduce((acc, key, index) => {
          const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"; // キーを対応させるアルファベット配列
          acc[alphabet[index]] = defData[key] ?? null; // マッピングにキーと値を追加
          return acc;
        }, {} as Record<string, string | null>);

      // 作業詳細を `workDetail` の `$` 区切りで分割した配列
      let splitDetails = workDetail.split("$").map((detail) => detail || "");

      let adjustedTimeWork = timeWork;
      if (tyoku === "1" || tyoku === "5") {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(54, timeWork.length * 2 - 234)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(54, splitDetails.length * 2 - 234);
      } else if (tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")) {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(106, timeWork.length * 2 - 182)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(106, splitDetails.length * 2 - 182);
      } else if (tyoku === "2") {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(140, timeWork.length * 2 - 148)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(140, splitDetails.length * 2 - 148);
      } else if (tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")) {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(214, timeWork.length * 2 - 74)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(214, splitDetails.length * 2 - 74);
      } else if (tyoku === "3") {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(242, timeWork.length * 2 - 46)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(242, splitDetails.length * 2 - 46);
      } else if (tyoku === "4") {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(72, timeWork.length * 2 - 216)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(72, splitDetails.length * 2 - 216);
      } else if (tyoku === "6") {
        adjustedTimeWork = Array.from(timeWork)
          .concat(Array.from(timeWork))
          .slice(182, timeWork.length * 2 - 106)
          .join("");

        splitDetails = splitDetails
          .concat(splitDetails)
          .slice(182, splitDetails.length * 2 - 106);
      }

      for (let i = 0; i <= adjustedTimeWork.length; i++) {
        const charWork = adjustedTimeWork[i]; // 現在処理中の文字
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork]; // `$`を特別な文字として解釈
        const charDetail = splitDetails[Math.floor(i / (adjustedTimeWork.length / splitDetails.length))] ?? ""; // 対応する詳細を取得

        // セッション終了条件：無効な文字が検出された場合
        if (charWork === "#" || charWork === undefined) {
          if (currentWork || currentDetail) {
            if (tyoku === "1" || tyoku === "5") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 54) / 12) % 24;
              const startMinute = (startIndex + 54) % 12 * 5;
              const endHour = Math.floor((i + 54) / 12) % 24;
              const endMinute = (i + 54) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")) {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 106) / 12) % 24;
              const startMinute = (startIndex + 106) % 12 * 5;
              const endHour = Math.floor((i + 106) / 12) % 24;
              const endMinute = (i + 106) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "2") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 140) / 12) % 24;
              const startMinute = (startIndex + 140) % 12 * 5;
              const endHour = Math.floor((i + 140) / 12) % 24;
              const endMinute = (i + 140) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")) {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 214) / 12) % 24;
              const startMinute = (startIndex + 214) % 12 * 5;
              const endHour = Math.floor((i + 214) / 12) % 24;
              const endMinute = (i + 214) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "3") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 242) / 12) % 24;
              const startMinute = (startIndex + 242) % 12 * 5;
              const endHour = Math.floor((i + 242) / 12) % 24;
              const endMinute = (i + 242) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "4") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 72) / 12) % 24;
              const startMinute = (startIndex + 72) % 12 * 5;
              const endHour = Math.floor((i + 72) / 12) % 24;
              const endMinute = (i + 72) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "6") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 182) / 12) % 24;
              const startMinute = (startIndex + 182) % 12 * 5;
              const endHour = Math.floor((i + 182) / 12) % 24;
              const endMinute = (i + 182) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex * 5) / 60) % 24;
              const startMinute = (startIndex * 5) % 60;
              const endHour = Math.floor((i * 5) / 60) % 24;
              const endMinute = (i * 5) % 60;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            }
          }
          // セッションをリセット
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          // 状態変化の場合（作業タイトルまたは詳細が変更された場合）
          if (currentWork || currentDetail) {
            if (tyoku === "1" || tyoku === "5") {
              const startHour = Math.floor((startIndex + 54) / 12) % 24;
              const startMinute = (startIndex + 54) % 12 * 5;
              const endHour = Math.floor((i + 54) / 12) % 24;
              const endMinute = (i + 54) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")) {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 106) / 12) % 24;
              const startMinute = (startIndex + 106) % 12 * 5;
              const endHour = Math.floor((i + 106) / 12) % 24;
              const endMinute = (i + 106) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "2") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 140) / 12) % 24;
              const startMinute = (startIndex + 140) % 12 * 5;
              const endHour = Math.floor((i + 140) / 12) % 24;
              const endMinute = (i + 140) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")) {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 214) / 12) % 24;
              const startMinute = (startIndex + 214) % 12 * 5;
              const endHour = Math.floor((i + 214) / 12) % 24;
              const endMinute = (i + 214) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "3") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 242) / 12) % 24;
              const startMinute = (startIndex + 242) % 12 * 5;
              const endHour = Math.floor((i + 242) / 12) % 24;
              const endMinute = (i + 242) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "4") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 72) / 12) % 24;
              const startMinute = (startIndex + 72) % 12 * 5;
              const endHour = Math.floor((i + 72) / 12) % 24;
              const endMinute = (i + 72) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else if (tyoku === "6") {
              // 作業時間範囲を計算
              const startHour = Math.floor((startIndex + 182) / 12) % 24;
              const startMinute = (startIndex + 182) % 12 * 5;
              const endHour = Math.floor((i + 182) / 12) % 24;
              const endMinute = (i + 182) % 12 * 5;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            } else {
              const startHour = Math.floor((startIndex * 5) / 60) % 24;
              const startMinute = (startIndex * 5) % 60;
              const endHour = Math.floor((i * 5) / 60) % 24;
              const endMinute = (i * 5) % 60;

              const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              result.push({ time: timeRange, work: currentWork, detail: currentDetail });
            }
          }
          // 現在の作業を更新
          currentWork = mappedWork || charWork;
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      // パース結果を返却
      return result;
    };

    // 状態に解析されたデータを保存
    setParsedData(parseTimeWorkAndDetail());
  }, [timeWork, workDetail, updatedAt, defData, tyoku]);

  // ウィンドウサイズを監視して`maxHeight`を動的に更新
  useEffect(() => {
    const updateMaxHeight = () => setMaxHeight(window.innerHeight);

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // テーブル幅を計算する処理
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [parsedData]);

  return (
    <div
      className={styles["table-wrapper"]}
      style={{
        maxHeight: `${maxHeight}px`, // 最大高さを動的に設定
        overflowY: "auto", // 垂直スクロールを活性化
        width: `${tableWidth + 5}px`, // テーブルに合わせた幅
      }}
    >
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