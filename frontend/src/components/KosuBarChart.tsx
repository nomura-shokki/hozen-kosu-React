import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Chart.jsのモジュールを登録
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// コンポーネントのプロパティ型定義
interface Props {
  initialTimeWork: string | null; // 作業に基づいた時間データ（nullの場合もある）
  tyoku: string;
  shop: string;
}

// 入力文字列を数値配列に変換する関数
const convertToData = (input: string | null): number[] => {
  if (!input) return []; // 入力がnullの場合、空の配列を返す

  // A〜Zおよびa〜zを数値にマッピングする
  const charMap: { [key: string]: number } = {};
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("").forEach((char, index) => {
    charMap[char] = (index % 26) + 1; // 大文字・小文字に関係なく1〜26にマッピング
  });

  // 入力文字列の各文字を数値に変換
  return input.split("").map((char) => charMap[char] || 0); // 変換できない文字は0にする
};

// ラベルを生成する関数（1日を5分間隔に区切ったタイムスロット）
const generateTimeLabels = () => {
  const labels: string[] = [];
  for (let i = 0; i < 288; i++) {
    const hours = Math.floor(i * 5 / 60).toString().padStart(2, "0"); // 時間を計算しゼロ埋め
    const minutes = (i * 5 % 60).toString().padStart(2, "0"); // 分を計算しゼロ埋め
    labels.push(`${hours}:${minutes}`); // 時間:分としてラベルを生成
  }
  return labels; // 時間ラベルの配列を返す
};

// 色パレットを生成する関数（50色を生成）
const generateColorPalette = (): string[] => {
  const colors = [];
  const step = Math.floor(360 / 50);
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * step) % 360}, 70%, 50%)`);
  }
  return colors;
};

// 棒グラフコンポーネントの定義
const KosuBarChart: React.FC<Props> = ({ initialTimeWork, tyoku, shop }) => {
  const chartData = convertToData(initialTimeWork);
  const colorPalette = generateColorPalette();
  const originalLabels = generateTimeLabels();

  const labels =
    tyoku === "1"
      ? [...originalLabels.slice(54), ...originalLabels.slice(0, 54)]
      : tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...originalLabels.slice(106), ...originalLabels.slice(0, 106)]
      : tyoku === "2"
      ? [...originalLabels.slice(140), ...originalLabels.slice(0, 140)]
      : tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...originalLabels.slice(214), ...originalLabels.slice(0, 214)]
      : tyoku === "3"
      ? [...originalLabels.slice(242), ...originalLabels.slice(0, 242)]
      : tyoku === "4"
      ? [...originalLabels.slice(72), ...originalLabels.slice(0, 72)]
      : tyoku === "5"
      ? [...originalLabels.slice(54), ...originalLabels.slice(0, 54)]
      : tyoku === "6"
      ? [...originalLabels.slice(182), ...originalLabels.slice(0, 182)]
      : originalLabels;

  let chartDataModified =
    tyoku === "1"
      ? [...chartData.slice(54), ...chartData.slice(0, 54)]
      : tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...chartData.slice(106), ...chartData.slice(0, 106)]
      : tyoku === "2"
      ? [...chartData.slice(140), ...chartData.slice(0, 140)]
      : tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...chartData.slice(214), ...chartData.slice(0, 214)]
      : tyoku === "3"
      ? [...chartData.slice(242), ...chartData.slice(0, 242)]
      : tyoku === "4"
      ? [...chartData.slice(72), ...chartData.slice(0, 72)]
      : tyoku === "5"
      ? [...chartData.slice(54), ...chartData.slice(0, 54)]
      : tyoku === "6"
      ? [...chartData.slice(182), ...chartData.slice(0, 182)]
      : chartData;

  // 後ろから探索して0以外の値が出た位置を取得
  let lastNonZeroIndex = chartDataModified.length - 1;
  while (lastNonZeroIndex >= 0 && chartDataModified[lastNonZeroIndex] === 0) {
    lastNonZeroIndex--;
  }

  // 削除対象の範囲を計算（ただし130要素より前は削除しない）
  const removeEndIndex = Math.max(lastNonZeroIndex + 2, 130);
  chartDataModified = chartDataModified.slice(0, removeEndIndex);

  // === ここから新しい前方修正の追加コード ===
  // 前方から探索して0以外の値が出た最初の位置を取得
  let firstNonZeroIndex = 0;
  while (firstNonZeroIndex < chartDataModified.length && chartDataModified[firstNonZeroIndex] === 0) {
    firstNonZeroIndex++;
  }

  // 削除対象の範囲を計算（ただし0より前は削除しない）
  const removeStartIndex = Math.max(firstNonZeroIndex - 2, 0);
  chartDataModified = chartDataModified.slice(removeStartIndex);

  // ラベルもchartDataModifiedの長さに合わせて切り詰める
  labels.splice(0, removeStartIndex);
  labels.length = chartDataModified.length;
  // === 変更終了 ===

  const data = {
    labels,
    datasets: [
      {
        label: "作業時間データ",
        data: chartDataModified,
        backgroundColor: chartDataModified.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 0.6)"),
        borderColor: chartDataModified.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 1)"),
        borderWidth: 1,
        barPercentage: 1,
        categoryPercentage: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          display: false,
        },
        grid: {
          display: false,
        },
      },
      x: {
        type: 'category',
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        barThickness: 'flex',
      },
    },
  } as const;

  return <Bar data={data} options={options} />;
};

export default KosuBarChart;