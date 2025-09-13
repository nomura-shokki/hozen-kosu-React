import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
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
import ChartDataLabels from "chartjs-plugin-datalabels";
import styles from "../styles/KosuPage/KosuTotal.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface KosuData {
  time_work: string;
}

interface ApiResponseData {
  member_data: object;
  kosu_data: KosuData;
  def_data: { [key: string]: string };
  session_day: string;
}

// processDataForChartの戻り値の型を定義
interface ChartDataWithElements {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
  }[];
  chartElements: {
    label: string;
    value: number;
    backgroundColor: string;
  }[];
}

const generateColorPalette = (): string[] => {
  const colors = [];
  const step = Math.floor(360 / 50);
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * step) % 360}, 70%, 50%)`);
  }
  return colors;
};

const KosuTotal: React.FC = () => {
  const [apiData, setApiData] = useState<ApiResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("日間");
  const [selectedOrder, setSelectedOrder] = useState<string>("標準");

  const navigate = useNavigate();

  // POSTリクエストを処理する関数（フォーム変更時）
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/kosu_total/`,
        {
          date: selectedDate,
          period: selectedPeriod,
        },
        { withCredentials: true }
      );
      setApiData(response.data);
      setLoading(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 404) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError("データの取得中にエラーが発生しました。");
        }
      } else {
        setError("予期しないエラーが発生しました。");
      }
      setLoading(false);
    }
  }, [navigate, selectedDate, selectedPeriod]);

  // 初回データ取得（コンポーネントマウント時）
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/api/kosu_total/`,
          { withCredentials: true }
        );
        setApiData(response.data);
        if (response.data.session_day) {
          setSelectedDate(response.data.session_day);
        }
        setLoading(false);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401 || err.response?.status === 404) {
            navigate("/login");
          } else if (err.response?.status === 403) {
            navigate("/");
          } else {
            setError("データの取得中にエラーが発生しました。");
          }
        } else {
          setError("予期しないエラーが発生しました。");
        }
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [navigate]);

  // 日付または期間が変更された時のみデータを再取得
  useEffect(() => {
    // 初回レンダリング時には実行しないようにする
    if (selectedDate) {
      fetchData();
    }
  }, [fetchData, selectedDate, selectedPeriod]);

  const processDataForChart = (data: ApiResponseData): ChartDataWithElements => {
    const { kosu_data, def_data } = data;
    const { time_work } = kosu_data;
  
    const labels: string[] = [];
    const chartData: number[] = [];
    const backgroundColors: string[] = [];
    
    const chartElements: { label: string, value: number, backgroundColor: string }[] = [];

    const charMap =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx".split("");
    const colorPalette = generateColorPalette();

    if (typeof time_work !== "string" || !time_work) {
      return {
        labels: [],
        datasets: [
          {
            label: "作業時間（分）",
            data: [],
            backgroundColor: [],
          },
        ],
        chartElements: [], // 空の配列を返す
      };
    }

    for (let i = 1; i <= 50; i++) {
      const titleKey = `kosu_title_${i}`;
      const title = def_data[titleKey];

      if (!title) {
        break;
      }

      const char = charMap[i - 1];
      const count = (time_work.match(new RegExp(char, "g")) || []).length;
      const value = count * 5;

      chartElements.push({
        label: title,
        value: value,
        backgroundColor: colorPalette[i - 1]
      });
    }

    if (selectedOrder === "多い順") {
      chartElements.sort((a, b) => b.value - a.value);
    }

    chartElements.forEach(element => {
      labels.push(element.label);
      chartData.push(element.value);
      backgroundColors.push(element.backgroundColor);
    });

    return {
      labels: labels,
      datasets: [
        {
          label: "作業時間（分）",
          data: chartData,
          backgroundColor: backgroundColors,
        },
      ],
      chartElements: chartElements,
    };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      datalabels: {
        anchor: "end" as "end",
        align: "start" as "start",
        formatter: (value: number) => {
          return value > 0 ? value.toString() : "";
        },
        // データラベルのフォントサイズを動的に設定
        font: (context: any) => {
          const chartWidth = context.chart.width;
          let fontSize = 12; // デフォルトサイズ
          if (chartWidth < 600) {
            fontSize = 10;
          }
          if (chartWidth < 400) {
            fontSize = 8;
          }
          return {
            size: fontSize,
            weight: 'bold' as const,
          };
        }
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 90,
          minRotation: 90,
          // X軸ラベルのフォントサイズを動的に設定
          font: (context: any) => {
            const chartWidth = context.chart.width;
            let fontSize = 12; // デフォルトサイズ
            if (chartWidth < 600) {
              fontSize = 10;
            }
            if (chartWidth < 400) {
              fontSize = 8;
            }
            return {
              size: fontSize
            };
          },
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "工数（分）",
        },
      },
    },
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(e.target.value);
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOrder(e.target.value);
  };

  if (loading) {
    return <Loading isLoading={true} />;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!apiData) {
    return <div className={styles.noData}>データがありません。</div>;
  }

  const chartData = processDataForChart(apiData);

  return (
    <div className={styles["kosu-total-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数集計</h1>
      <nav className={styles["kosu-nav"]}>
        <Link to="/kosu-menu">工数MENU</Link>
      </nav>
      <div className={styles["kosu-total-form"]}>
        <label htmlFor="date-picker">日付:</label>
        <input
          type="date"
          id="date-picker"
          value={selectedDate}
          onChange={handleDateChange}
          className={styles["date-picker-input"]}
        />
        <label htmlFor="period-select">期間:</label>
        <select
          id="period-select"
          value={selectedPeriod}
          onChange={handlePeriodChange}
          className={styles["period-select"]}
        >
          <option value="日間">日間</option>
          <option value="月間">月間</option>
          <option value="年間">年間</option>
        </select>
        <label htmlFor="order-select">並び順:</label>
        <select
          id="order-select"
          value={selectedOrder}
          onChange={handleOrderChange}
          className={styles["order-select"]}
        >
          <option value="標準">標準</option>
          <option value="多い順">多い順</option>
        </select>
      </div>
      <div className={styles["chart-container"]}>
        <Bar data={chartData} options={options} />
      </div>
      <div className={styles.chartDataList}>
        {chartData.chartElements.map((element, index) => (
          <div key={index} className={styles.dataListItem}>
            <span style={{ backgroundColor: element.backgroundColor }} className={styles.colorBox}></span>
            <span className={styles.itemLabel}>{element.label}</span>
            <span className={styles.itemValue}>{element.value}分</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KosuTotal;