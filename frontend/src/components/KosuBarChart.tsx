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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  initialTimeWork: string | null;
}

const convertToData = (input: string | null): number[] => {
  if (!input) return [];
  const charMap: { [key: string]: number } = {};
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("").forEach((char, index) => {
    charMap[char] = (index % 26) + 1; // A〜Z: 1〜26, a〜z: 1〜26
  });

  return input.split("").map((char) => charMap[char] || 0);
};

const generateTimeLabels = () => {
  const labels: string[] = [];
  for (let i = 0; i < 288; i++) {
    const hours = Math.floor(i * 5 / 60).toString().padStart(2, "0");
    const minutes = (i * 5 % 60).toString().padStart(2, "0");
    labels.push(`${hours}:${minutes}`);
  }
  return labels;
};

// 50色のカラーパレットを生成
const generateColorPalette = (): string[] => {
  const colors = [];
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * 360) / 50}, 70%, 50%)`); // 色相を均等分割
  }
  return colors;
};

const KosuBarChart: React.FC<Props> = ({ initialTimeWork }) => {
  const chartData = convertToData(initialTimeWork);
  const colorPalette = generateColorPalette();

  const data = {
    labels: generateTimeLabels(),
    datasets: [
      {
        label: "作業時間データ",
        data: chartData,
        backgroundColor: chartData.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 0.6)"), // 値に基づいて色を選択
        borderColor: chartData.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 1)"),
        borderWidth: 1,
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
        type: 'category', // スケールタイプを明示的に指定
        barPercentage: 1.0, // バーの幅を最大化
        categoryPercentage: 1.0, // カテゴリー幅を最大化
        barThickness: 'flex', // バーの間隔を調整して隙間を完全になくす
      },
    },
  } as const;
  

  return <Bar data={data} options={options} />;
};

export default KosuBarChart;
