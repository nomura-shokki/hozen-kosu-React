import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/components/KosuDisplay.module.css";

// 受け取るデータ構造指定
interface KosuDisplayProps {
  timeWork: string; // `timeWork`は288文字の作業内容を保持する文字列
  workDetail: string; // `workDetail`は`$`で区切られた作業詳細を表す文字列
  updatedAt: Date; // データが最後に更新されたタイムスタンプ（Date型）
  defData: { [key: string]: string | undefined }; // 作業内容のマッピングを行うキーと値のペア
  tyoku: string;
  shop: string;
}

// KosuDisplayコンポーネントの定義
const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, workDetail, updatedAt, defData }) => {
  // パースされた作業データを保持する状態変数
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブルの最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブルの幅
  const tableRef = useRef<HTMLTableElement>(null); // テーブル要素の参照

  // Reactのライフサイクルメソッドを使用してデータを解析する
  useEffect(() => {
    // `timeWork`と`workDetail`を解析してパースされた結果を返す関数
    const parseTimeWorkAndDetail = () => {
      // 結果を格納する配列
      const result: { time: string; work: string; detail: string }[] = [];
      let currentWork = ""; // 現在の作業内容を一時的に保持する変数
      let currentDetail = ""; // 現在の作業詳細を一時的に保持する変数
      let startIndex = -1; // 現在のセッション開始位置を保持する変数

      // `defData`を基に作業内容マッピングを作成
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_")) // `kosu_title_`で始まるキーのみを抽出
        .reduce((acc, key, index) => {
          const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"; // アルファベットを作業内容に対応付ける
          acc[alphabet[index]] = defData[key] ?? null; // データが`undefined`の場合は`null`を格納
          return acc; // 累積オブジェクトを返す
        }, {} as Record<string, string | null>);

      // `$`で区切られた作業詳細リストを作成
      const splitDetails = workDetail.split("$").map((detail) => detail || ""); // `$`が空文字の場合にデフォルト値として空文字を設定

      // `timeWork`を解析してセッションを判定
      for (let i = 0; i <= timeWork.length; i++) {
        const charWork = timeWork[i]; // 現在の`timeWork`内の文字を取得
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork]; // `$`の場合は特別な「休憩」として扱う
        const charDetail = splitDetails[Math.floor(i / (timeWork.length / splitDetails.length))] ?? ""; // 詳細リストのインデックスを計算して取得

        // 条件: スキップ対象文字(`#`または`undefined`)
        if (charWork === "#" || charWork === undefined) {
          // スキップ中で、現在の作業が終了した場合
          if (currentWork !== "" || currentDetail !== "") {
            // 作業の時間範囲を計算
            const startHour = Math.floor((startIndex * 5) / 60); // 開始時刻の時間部分
            const startMinute = (startIndex * 5) % 60; // 開始時刻の分部分
            const endHour = Math.floor((i * 5) / 60); // 終了時刻の時間部分
            const endMinute = (i * 5) % 60; // 終了時刻の分部分

            const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`; // 時間範囲を文字列に整形
            result.push({
              time: timeRange, // 時間範囲を格納
              work: currentWork, // 作業内容を格納
              detail: currentDetail, // 作業詳細を格納
            });
          }
          // セッションをリセット
          currentWork = "";
          currentDetail = "";
          startIndex = -1; // スタート位置もリセット
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          // 作業内容または詳細が変更された場合
          if (currentWork !== "" || currentDetail !== "") {
            // 作業の時間範囲を計算
            const startHour = Math.floor((startIndex * 5) / 60); // 開始時刻の時間部分
            const startMinute = (startIndex * 5) % 60; // 開始時刻の分部分
            const endHour = Math.floor((i * 5) / 60); // 終了時刻の時間部分
            const endMinute = (i * 5) % 60; // 終了時刻の分部分

            const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`; // 時間範囲を文字列に整形
            result.push({
              time: timeRange, // 時間範囲を格納
              work: currentWork, // 作業内容を格納
              detail: currentDetail, // 作業詳細を格納
            });
          }
          // 新しいセッションを開始
          currentWork = mappedWork || charWork; // 作業内容を更新（マッピングされたタイトルを優先）
          currentDetail = charDetail; // 詳細を更新
          startIndex = i; // セッション開始位置を更新
        }
      }

      return result; // パース結果を返す
    };

    // パース結果を状態変数に設定
    setParsedData(parseTimeWorkAndDetail());
  }, [timeWork, workDetail, updatedAt, defData]); // 依存配列で監視する値を指定

  // ウィンドウサイズ変更時にテーブルの最大高さを再計算
  useEffect(() => {
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight - 40); // スペースを差し引いて高さを設定
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight); // リサイズイベントのリスナー追加
    return () => window.removeEventListener("resize", updateMaxHeight); // クリーンアップ
  }, []);

  // テーブルの幅を更新するuseEffect
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth); // リサイズイベント
  }, [parsedData]);

  // レンダリング: パースされた作業データを表示する
  return (
    <div
      className={styles["table-wrapper"]}
      style={{
        maxHeight: `${maxHeight}px`, // テーブルの縦サイズを設定
        overflowY: "auto",
        width: `${tableWidth + 10}px`, // テーブル横サイズを設定
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

export default KosuDisplay; // コンポーネントをエクスポート