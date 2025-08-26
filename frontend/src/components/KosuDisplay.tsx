// 必要なReactフックやCSSモジュールをインポート
import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/components/KosuDisplay.module.css";

// データ構造を表すインターフェースを定義
interface KosuDisplayProps {
  timeWork: string; // 288文字で表現された作業内容を保持する文字列
  workDetail: string; // 作業詳細を表す`$`で区切られた文字列
  updatedAt: Date; // データが最後に更新されたタイムスタンプ
  defData: { [key: string]: string | undefined }; // 作業内容とそのマッピングデータを保持
  tyoku: string; // その他のプロパティ（UIで利用されている可能性あり）
  shop: string; // その他のプロパティ（UIで利用されている可能性あり）
}

// KosuDisplayコンポーネントを定義（ReactのFunctional Componentとして）
const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, workDetail, updatedAt, defData }) => {
  // パース済みの作業データを保持する状態変数
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);
  
  // テーブルの最大高さを動的に調整するための状態変数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  
  // テーブル全体の幅を保持する状態変数
  const [tableWidth, setTableWidth] = useState<number>(0);
  
  // テーブル要素への参照を保持
  const tableRef = useRef<HTMLTableElement>(null);

  // 初期化とともに作業内容と詳細をパースして状態に格納
  useEffect(() => {
    const parseTimeWorkAndDetail = () => {
      // パース結果を格納する配列
      const result: { time: string; work: string; detail: string }[] = [];
      
      // 現在処理中の作業内容や詳細を保持する変数
      let currentWork = "";
      let currentDetail = "";
      let startIndex = -1; // セッションの開始位置（インデックス）

      // `kosu_title_`で始まるキーをマッピングとして作成
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_")) // 必要なキーのみ抽出
        .reduce((acc, key, index) => {
          const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"; // 対応するアルファベット配列
          acc[alphabet[index]] = defData[key] ?? null; // マッピングを作成
          return acc;
        }, {} as Record<string, string | null>);

      // `$`で区切られた詳細リストを作成
      const splitDetails = workDetail.split("$").map((detail) => detail || "");

      // 文字列`timeWork`を1文字ずつ処理
      for (let i = 0; i <= timeWork.length; i++) {
        const charWork = timeWork[i]; // 現在の文字
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork]; // 特別な文字`$`の場合は休憩と解釈
        const charDetail = splitDetails[Math.floor(i / (timeWork.length / splitDetails.length))] ?? ""; // 対応する詳細を取得

        // 条件: 無効な文字の場合、セッション終了をチェック
        if (charWork === "#" || charWork === undefined) {
          if (currentWork || currentDetail) {
            // 時間範囲を計算しフォーマット
            const startHour = Math.floor((startIndex * 5) / 60);
            const startMinute = (startIndex * 5) % 60;
            const endHour = Math.floor((i * 5) / 60);
            const endMinute = (i * 5) % 60;

            const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            result.push({ time: timeRange, work: currentWork, detail: currentDetail });
          }
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          if (currentWork || currentDetail) {
            const startHour = Math.floor((startIndex * 5) / 60);
            const startMinute = (startIndex * 5) % 60;
            const endHour = Math.floor((i * 5) / 60);
            const endMinute = (i * 5) % 60;

            const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            result.push({ time: timeRange, work: currentWork, detail: currentDetail });
          }
          currentWork = mappedWork || charWork; // 新しい作業タイトルを設定
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      return result;
    };

    // パースされたデータを保存
    setParsedData(parseTimeWorkAndDetail());
  }, [timeWork, workDetail, updatedAt, defData]);

  // ウィンドウサイズの変更を監視して`maxHeight`を更新
  useEffect(() => {
    const updateMaxHeight = () => setMaxHeight(window.innerHeight);

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // テーブル幅のリアルタイム計算
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

  // パース結果をテーブルとして表示
  return (
    <div
      className={styles["table-wrapper"]}
      style={{
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        width: `${tableWidth + 5}px`,
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
