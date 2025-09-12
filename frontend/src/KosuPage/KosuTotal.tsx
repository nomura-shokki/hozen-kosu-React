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
import styles from "../styles/KosuPage/KosuTotal.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface KosuData {
  time_work: string;
  def_data: { [key: string]: string };
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
  const [kosuData, setKosuData] = useState<KosuData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/api/kosu_total/`,
        { withCredentials: true }
      );
      setKosuData(response.data.kosu_data);
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
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const processDataForChart = (data: KosuData) => {
    const { time_work, def_data } = data;
    const labels = [];
    const chartData = [];
    const backgroundColors = [];

    const charMap =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
    const colorPalette = generateColorPalette();

    // Fix starts here: Check if time_work is a valid string before processing
    if (typeof time_work !== 'string' || !time_work) {
      return {
        labels: [],
        datasets: [
          {
            label: "作業時間（分）",
            data: [],
            backgroundColor: [],
          },
        ],
      };
    }
    // Fix ends here

    for (let i = 1; i <= 50; i++) {
      const titleKey = `kosu_title_${i}`;
      const title = def_data[titleKey];

      if (!title) {
        break;
      }

      const char = charMap[i - 1];
      const count = (time_work.match(new RegExp(char, "g")) || []).length;
      const value = count * 5;

      labels.push(title);
      chartData.push(value);
      backgroundColors.push(colorPalette[i - 1]);
    }

    return {
      labels: labels,
      datasets: [
        {
          label: "作業時間（分）",
          data: chartData,
          backgroundColor: backgroundColors,
        },
      ],
    };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "工数集計グラフ",
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "時間（分）",
        },
      },
    },
  };

  if (loading) {
    return <Loading isLoading={true} />;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!kosuData) {
    return <div className={styles.noData}>データがありません。</div>;
  }

  const chartData = processDataForChart(kosuData);

  return (
    <div className={styles["kosu-total-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数集計</h1>
      <nav className={styles["kosu-nav"]}>
        <Link to="/kosu-menu">工数MENU</Link>
      </nav>
      <div className={styles["chart-container"]}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default KosuTotal;