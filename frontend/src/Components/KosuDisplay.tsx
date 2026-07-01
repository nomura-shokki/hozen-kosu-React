import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/Components/KosuDisplay.module.css";

// コンポーネントが受け取るpropsの型定義
interface KosuDisplayProps {
  timeWork: string; 
  workDetail: string;
  updatedAt: Date; // データの更新日時（データの変更を検知するために使用）
  defData: { [key: string]: string | undefined }; // 作業コードとタイトルのマッピングデータ
  tyoku: string; // 勤務シフト（例: "1", "2" など）
  shop: string; // 部署・ショップ情報（特定のシフトの調整に使用）
  work?: string; // 勤務
  headerColor?: string;
}

// Reactの関数コンポーネント定義
const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, workDetail, updatedAt, defData, tyoku, shop, work, headerColor }) => {
  // パースされたデータを格納するステート
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);
  // テーブルの大きさ測定
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  // 変更時に実行されるエフェクト
  useEffect(() => {
    // timeWorkとworkDetailをパースする関数
    const parseTimeWorkAndDetail = () => {
      // defDataから`kosu_title_`で始まるキーをフィルタリングし、
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .reduce((acc, key, index) => {
          acc["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"[index]] = defData[key] ?? null;
          return acc;
        }, {} as Record<string, string | null>);

      // 勤務シフトに応じて時間文字列の範囲を調整するヘルパー関数
      const adjustRange = (start: number, end: number) => ({
        // timeWorkを2回繰り返して、指定された開始・終了オフセットで切り取る
        adjustedTimeWork: timeWork.repeat(2).slice(start, timeWork.length * 2 - end),
        // workDetailを2回繰り返して、指定された開始・終了オフセットで切り取る
        splitDetails: workDetail.split("$").concat(workDetail.split("$")).slice(start, workDetail.split("$").length * 2 - end)
      });

      // 勤務シフトごとの調整範囲を定義
      const ranges: Record<string, { start: number; end: number }> = {
        "1": { start: 54, end: 234 },
        "2W_A": { start: 106, end: 182 },
        "2": { start: 142, end: 146 },
        "3W_A": { start: 214, end: 74 },
        "3": { start: 245, end: 43 },
        "4": { start: 72, end: 216 },
        "6": { start: 182, end: 106 },
      };
      // 勤務シフトとショップに基づいて適切な調整範囲キーを決定
      const rangeKey = tyoku + ((tyoku === "2" || tyoku === "3") && (["W1", "W2", "A1", "A2", "J", "組長以上(W,A)"].includes(shop)) ? "W_A" : "");

      // 適切な調整範囲が定義されていれば適用、そうでなければ元の文字列を使用
      const { adjustedTimeWork, splitDetails } = ranges[rangeKey]
        ? adjustRange(ranges[rangeKey].start, ranges[rangeKey].end)
        : { adjustedTimeWork: timeWork, splitDetails: workDetail.split("$") };

      // パース結果を格納する配列
      const result: { time: string; work: string; detail: string }[] = [];     
      // 現在の作業内容、詳細、開始インデックスを追跡する変数
      let currentWork = "", currentDetail = "", startIndex = -1;

      // セッション終了または状態変化の際に結果を配列に追加するヘルパー関数
      const pushResult = (i: number, offset: number) => {
        if (currentWork || currentDetail) {
          // 開始時間と終了時間を計算
          const startHour = Math.floor((startIndex + offset) / 12) % 24;
          const startMinute = ((startIndex + offset) % 12) * 5;
          const endHour = Math.floor((i + offset) / 12) % 24;
          const endMinute = ((i + offset) % 12) * 5;
          // 時間範囲の文字列をフォーマット
          const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
          // 結果配列にプッシュ
          result.push({ time: timeRange, work: currentWork, detail: currentDetail });
        }
      };

      // adjustedTimeWork文字列を1文字ずつループ
      for (let i = 0; i <= adjustedTimeWork.length; i++) {
        const charWork = adjustedTimeWork[i]; // 時間・作業コードの現在の文字
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork]; // コードを対応する作業内容にマッピング
        const charDetail = splitDetails[Math.floor(i / (adjustedTimeWork.length / splitDetails.length))] ?? ""; // 対応する作業詳細を取得

        // `#` または文字列の終端で現在のセッションを終了
        if (charWork === "#" || charWork === undefined) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          // 作業内容または詳細が変更された場合に、前のセッションを終了し、新しいセッションを開始
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = mappedWork || charWork; // マッピングされた作業内容、または元の文字
          currentDetail = charDetail;
          startIndex = i;
        }
      }
      return result;
    };

    // パース関数を実行し、ステートを更新
    setParsedData(parseTimeWorkAndDetail());
  }, [timeWork, workDetail, updatedAt, defData, tyoku, shop]);

  // ウィンドウサイズ変更時に`maxHeight`を更新するエフェクト
  useEffect(() => {
    const updateMaxHeight = () => setMaxHeight(window.innerHeight);
    updateMaxHeight(); // 初回レンダリング時にも実行
    window.addEventListener("resize", updateMaxHeight); // リサイズイベントリスナーを追加
    return () => window.removeEventListener("resize", updateMaxHeight); // クリーンアップ関数
  }, []); // 空の依存配列は、コンポーネントのマウント時とアンマウント時にのみ実行

  // `parsedData`が変更された時にテーブルの幅を更新するエフェクト
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
    };
    updateTableWidth(); // 初回レンダリング時とデータ更新時に実行
    window.addEventListener("resize", updateTableWidth); // リサイズイベントリスナーを追加
    return () => window.removeEventListener("resize", updateTableWidth); // クリーンアップ関数
  }, [parsedData]); // `parsedData`が変更されたら再実行

  const headerStyle = { backgroundColor: headerColor }

  // 合計時間を計算 (#と$を除いた文字数 * 5分)
  const totalMinutes = timeWork.replace(/[#$]/g, "").length * 5;

  // 基準合計工数作成関数（Pythonロジックの移植）
  const getDefaultTotal = () => {
    let default_total: string | number = 0;
    const shopP_R_T = ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'];
    const shopW_A = ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)'];

    if (work === '出勤' || work === 'シフト出') {
      default_total = 470;
    } else if (work === '休出') {
      default_total = 0;
    } else if (work === '出勤(時短なし)') {
      default_total = 480;
    } else if (work === '半前年休(時短なし)' || work === '半後年休(時短なし)') {
      default_total = 240;
    } else if (work === '遅刻・早退') {
      default_total = '-';
    } else if (shopP_R_T.includes(shop || "") && tyoku === '1' && work === '半前年休') {
      default_total = 220;
    } else if (shopP_R_T.includes(shop || "") && tyoku === '1' && work === '半後年休') {
      default_total = 250;
    } else if (shopP_R_T.includes(shop || "") && tyoku === '2' && work === '半前年休') {
      default_total = 230;
    } else if (shopP_R_T.includes(shop || "") && tyoku === '2' && work === '半後年休') {
      default_total = 240;
    } else if (shopP_R_T.includes(shop || "") && tyoku === '3' && work === '半前年休') {
      default_total = 275;
    } else if (shopP_R_T.includes(shop || "") && tyoku === '3' && work === '半後年休') {
      default_total = 195;
    } else if (shopW_A.includes(shop || "") && tyoku === '1' && work === '半前年休') {
      default_total = 230;
    } else if (shopW_A.includes(shop || "") && tyoku === '1' && work === '半後年休') {
      default_total = 240;
    } else if (shopW_A.includes(shop || "") && tyoku === '2' && work === '半前年休') {
      default_total = 290;
    } else if (shopW_A.includes(shop || "") && tyoku === '2' && work === '半後年休') {
      default_total = 180;
    } else if (shopW_A.includes(shop || "") && tyoku === '3' && work === '半前年休') {
      default_total = 230;
    } else if (shopW_A.includes(shop || "") && tyoku === '3' && work === '半後年休') {
      default_total = 240;
    } else if (tyoku === '4' && work === '半前年休') {
      default_total = 230;
    } else if (tyoku === '4' && work === '半後年休') {
      default_total = 240;
    } else if ((tyoku === '5' || tyoku === '6') && work === '半前年休') {
      default_total = 220;
    } else if ((tyoku === '5' || tyoku === '6') && work === '半後年休') {
      default_total = 250;
    }

    return default_total;
  };

  const defaultTotal = getDefaultTotal();

  return (
    <div className={styles["table-wrapper"]} style={{ maxHeight: `${maxHeight}px`, overflowY: "auto", width: `${tableWidth + 15}px` }}>
      <table ref={tableRef}>
        <thead>
          <tr>
            <th style={headerStyle}>作業時間</th>
            <th style={headerStyle}>作業内容</th>
            <th style={headerStyle}>作業詳細</th>
          </tr>
        </thead>
        <tbody>
          {parsedData.map((item, index) => (
            <React.Fragment key={index}>
              <tr>
                <td>{item.time}</td>
                <td>{item.work}</td>
                <td>{item.detail}</td>
              </tr>
            </React.Fragment>
          ))}
          <tr>
            <td>工数合計(基準時間)</td>
            <td>{totalMinutes}分({defaultTotal}分)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default KosuDisplay;