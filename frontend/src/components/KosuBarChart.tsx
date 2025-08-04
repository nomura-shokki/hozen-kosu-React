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
// 以下のモジュールを使用してグラフを構築する
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
    // 1日を5分刻みで区切るためには288スロットが必要（24時間 × 60分 ÷ 5分）
    const hours = Math.floor(i * 5 / 60).toString().padStart(2, "0"); // 時間を計算しゼロ埋め
    const minutes = (i * 5 % 60).toString().padStart(2, "0"); // 分を計算しゼロ埋め
    labels.push(`${hours}:${minutes}`); // 時間:分としてラベルを生成
  }
  return labels; // 時間ラベルの配列を返す
};

// 色パレットを生成する関数（50色を生成）
const generateColorPalette = (): string[] => {
  const colors = [];
  for (let i = 0; i < 50; i++) {
    // 色相を均等に分割し、鮮やかさと明るさを固定（HSL形式）
    colors.push(`hsl(${(i * 360) / 50}, 70%, 50%)`);
  }
  return colors; // 生成された色の配列を返す
};

// 棒グラフコンポーネントの定義
const KosuBarChart: React.FC<Props> = ({ initialTimeWork }) => {
  // 入力データを数値配列に変換
  const chartData = convertToData(initialTimeWork);
  // 色パレットを生成
  const colorPalette = generateColorPalette();

  // Chart.jsで使用するデータオブジェクトを定義
  const data = {
    // グラフのラベル（時間帯）
    labels: generateTimeLabels(),
    // データセットの定義
    datasets: [
      {
        label: "作業時間データ", // データセットのラベル
        data: chartData, // 作業時間に基づくデータ
        // 背景色はデータ値に応じて色パレットから選択（データ値がマッピング外の場合はデフォルト色）
        backgroundColor: chartData.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 0.6)"),
        // 枠線色（背景色と同じロジックで選択）
        borderColor: chartData.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 1)"),
        borderWidth: 1, // 枠線の幅
        barPercentage: 1, // 棒グラフの幅を最大化（カテゴリ間の隙間を削減）
        categoryPercentage: 1, // カテゴリ間の幅を最小化（隙間を削減）
      },
    ],
  };

  // Chart.jsのオプション設定
  const options = {
    responsive: true, // グラフがレスポンシブデザインをサポートする
    plugins: {
      legend: {
        display: false, // 凡例を非表示
      },
      title: {
        display: false, // タイトルを非表示
      },
    },
    scales: {
      y: {
        beginAtZero: true, // Y軸の値を0から開始
        max: 1, // Y軸の最大値を1に固定（データ値に関係なく）
        ticks: {
          display: false, // Y軸の目盛りを非表示
        },
        grid: {
          display: false, // Y軸のグリッドラインを非表示
        },
      },
      x: {
        type: 'category', // X軸をカテゴリタイプに設定
        barPercentage: 1.0, // バーの幅を最大化
        categoryPercentage: 1.0, // カテゴリー幅を最大化
        barThickness: 'flex', // バーの間隔を調整して隙間を完全になくす
      },
    },
  } as const; // TypeScriptでオプション型を強制するために型安全性を確保

  // グラフを表示
  return <Bar data={data} options={options} />;
};

export default KosuBarChart;