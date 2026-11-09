/**
 * ============================================================
 * ファイル名 : KosuTotal.tsx
 * 種別       : 画面コンポーネント（工数集計画面）
 * 概要       : ログイン者本人の工数を工数区分ごとに合計し、棒グラフと一覧で表示する画面。
 *              指定した日付を基準に「日間（その日）」「月間（その月）」「年間（その年）」で集計できる。
 *
 * 主な機能   :
 *   - 工数区分ごとの作業時間（分）の集計と棒グラフ表示
 *   - 日付・期間（日間/月間/年間）の切り替え（切り替えると自動で再集計）
 *   - 並び順（標準=工数区分の定義順 / 多い順）の切り替え
 *   - 工数区分名・色・合計時間の一覧表示
 *
 * 使用API    : GET  /api/kosu_total/  初期表示用の工数データ取得（kosu/views/kosu_views.py の KosuTotal）
 *              POST /api/kosu_total/  指定日付・期間の工数データ取得（同上）
 * 画面URL    : /kosu-total            （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/KosuTotal.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar } from "react-chartjs-2"; // Chart.js の棒グラフを React 部品として使うためのライブラリ
// Chart.js（グラフ描画ライブラリ）の部品。使う部品だけを読み込み、下で登録する
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import Loading from "../Components/Loading"; // 読み込み中の表示
import ChartDataLabels from "chartjs-plugin-datalabels"; // 棒グラフの各棒に数値を表示する Chart.js の追加機能
import styles from "../styles/KosuPage/KosuTotal.module.css";

// ============================================================
// Chart.js の初期設定
// ============================================================

// 棒グラフの描画に必要な部品を Chart.js に登録する（登録しないとグラフが描画できない）
//   CategoryScale: 横軸（工数区分名）/ LinearScale: 縦軸（分）/ BarElement: 棒
//   Title・Tooltip・Legend: タイトル・マウスを乗せたときの吹き出し・凡例 / ChartDataLabels: 棒の上の数値
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// ============================================================
// 型定義
// ============================================================

/** 工数データのうち、集計に使う項目 */
interface KosuData {
  time_work: string; // 作業内容（5分ごとの工数区分記号を288文字並べた文字列）
}

/**
 * GET / POST /api/kosu_total/ のレスポンス。
 *
 * 期間が「日間」のとき kosu_data は工数データ1件、「月間」「年間」のときは工数データの配列になる
 * （型は1件分で定義しているが、processDataForChart で配列の場合も処理している）。
 */
interface ApiResponseData {
  member_data: object; // ログイン者の人員データ（この画面では使わない）
  kosu_data: KosuData; // 集計対象の工数データ（1件 または 配列）
  def_data: { [key: string]: string }; // 工数区分定義（kosu_title_1〜50 に工数区分名が入る）
  session_day: string; // 基準となる就業日（"YYYY-MM-DD"）
}

/** 棒グラフ（react-chartjs-2 の Bar）に渡すデータ + 一覧表示用のデータ */
interface ChartDataWithElements {
  labels: string[]; // 横軸のラベル（工数区分名）
  datasets: {
    label: string; // データの名前（"作業時間（分）"）
    data: number[]; // 各工数区分の合計時間（分）
    backgroundColor: string[]; // 各棒の色
  }[];
  chartElements: {
    label: string; // 工数区分名
    value: number; // 合計時間（分）
    backgroundColor: string; // 表示色
  }[];
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 工数区分50個分の表示色を作る。
 *
 * 色相（hsl の1つ目の値。0〜360で色の種類を表す）を 7 ずつずらして50色を並べる
 * （360 ÷ 50 = 7.2 の小数を切り捨てて 7）。Components/KosuBarChart.tsx・DefTable.tsx と同じ計算式のため、
 * 同じ工数区分は他画面と同じ色になる。
 *
 * @returns 色の配列（例: ["hsl(0, 70%, 50%)", "hsl(7, 70%, 50%)", ...]、50要素）
 */
const generateColorPalette = (): string[] => {
  const colors = [];
  const step = Math.floor(360 / 50);
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * step) % 360}, 70%, 50%)`);
  }
  return colors;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数集計画面。
 *
 * 表示時に GET で基準日（セッションの就業日）を受け取り、その日付・期間で POST して集計対象を取得する。
 * 日付・期間を変えると自動で再取得し、並び順の変更はその場でグラフを並べ替える。
 *
 * @returns 工数集計画面のJSX
 */
const KosuTotal: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [apiData, setApiData] = useState<ApiResponseData | null>(null); // サーバーから受け取った集計対象データ
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [selectedDate, setSelectedDate] = useState<string>(""); // 集計の基準日（"YYYY-MM-DD"）。空文字の間は集計しない
  const [selectedPeriod, setSelectedPeriod] = useState<string>("日間"); // 集計期間（"日間" / "月間" / "年間"）
  const [selectedOrder, setSelectedOrder] = useState<string>("標準"); // 並び順（"標準"=工数区分の定義順 / "多い順"）

  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- データ取得 ----------

  /**
   * 選択中の基準日・期間で集計対象の工数データを取得し、state に保存する。
   *
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   * useEffect の依存配列に入れるため、useCallback で関数を使い回す
   * （基準日・期間が変わったときだけ作り直され、それをきっかけに再取得される）。
   *
   * @returns なし（結果は apiData / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // POST /api/kosu_total/ : 集計対象の工数データを取得
      //   date  : 基準日（"YYYY-MM-DD"）
      //   period: "日間"=その日の1件 / "月間"=同じ年月の全件 / "年間"=同じ年の全件
      const response = await api.post("/api/kosu_total/",
        {
          date: selectedDate,
          period: selectedPeriod,
        }
      );
      setApiData(response.data);
      setLoading(false);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または工数区分定義が見つからない → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [navigate, selectedDate, selectedPeriod]);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回）: 基準日（セッションの就業日）を取得する
  useEffect(() => {
    /**
     * 初期表示用のデータを取得し、基準日を selectedDate に設定する。
     *
     * 基準日が設定されると、下の useEffect により POST で集計対象が取得し直される。
     * 401（未ログイン）ならログイン画面へ遷移する。
     *
     * @returns なし（結果は apiData / selectedDate / error の state に反映）
     */
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // GET /api/kosu_total/ : セッションの就業日（未設定なら今日）の工数データと工数区分定義を取得
        const response = await api.get("/api/kosu_total/");
        setApiData(response.data);
        // サーバーから受け取った就業日を基準日として日付欄に設定する
        if (response.data.session_day) {
          setSelectedDate(response.data.session_day);
        }
        setLoading(false);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義が見つからない → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // その他: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [navigate]);

  // 基準日または期間が変わったとき: その条件で集計対象を取得し直す
  // （基準日が空文字の間＝初期データ取得前は実行しない）
  useEffect(() => {
    if (selectedDate) {
      fetchData();
    }
  }, [fetchData, selectedDate, selectedPeriod]);

  // ---------- データ加工 ----------

  /**
   * サーバーから受け取った工数データを、工数区分ごとの合計時間（棒グラフ用）に変換する。
   *
   * 作業内容の文字列は5分ごとに1文字の工数区分記号が並んでいる。
   * 記号は工数区分1〜50に対して "A"〜"Z","a"〜"x" が順に割り当てられているため、
   * 各記号の出現回数 × 5分 がその工数区分の合計時間になる。
   * 並び順が「多い順」のときは合計時間の大きい順に並べ替える。
   *
   * @param data - GET / POST /api/kosu_total/ のレスポンス
   * @returns 棒グラフに渡すデータと一覧表示用データ
   */
  const processDataForChart = (data: ApiResponseData): ChartDataWithElements => {
    const { kosu_data, def_data } = data;
    // 集計対象の作業内容を1本につないだ文字列（月間・年間は複数日分を連結する）
    let aggregatedTimeWork = "";

    // 月間・年間（配列）の場合は全件の作業内容を連結し、日間（1件）の場合はそのまま使う
    if (Array.isArray(kosu_data)) {
      aggregatedTimeWork = kosu_data.map(item => item.time_work).join("");
    } else {
      aggregatedTimeWork = kosu_data.time_work || "";
    }

    // 棒グラフに渡す配列（横軸ラベル・値・色）
    const labels: string[] = [];
    const chartData: number[] = [];
    const backgroundColors: string[] = [];
    
    // 工数区分ごとの集計結果（並べ替えと一覧表示に使う）
    const chartElements: { label: string, value: number, backgroundColor: string }[] = [];

    // 工数区分記号の一覧: 工数区分1 → "A"、… 26 → "Z"、27 → "a"、… 50 → "x"
    const charMap = 
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx".split("");
    const colorPalette = generateColorPalette();

    // 作業内容が空なら、空のグラフデータを返す
    if (!aggregatedTimeWork) {
      return { 
        labels: [],
        datasets: [ 
          { 
            label: "作業時間（分）",
            data: [],
            backgroundColor: [],
          },
        ],
        chartElements: [],
      };
    }

    // 工数区分1〜50を順に集計する
    for (let i = 1; i <= 50; i++) {
      const titleKey = `kosu_title_${i}`;
      const title = def_data[titleKey];

      // 工数区分名が空の番号に達したら、それ以降は未定義とみなして集計を終える
      if (!title) {
        break;
      }

      // i番目の工数区分の記号が作業内容に何回出てくるかを数え、×5 で分に換算する
      //   例: "A" が12回 → 60分
      const char = charMap[i - 1];
      const count = (aggregatedTimeWork.match(new RegExp(char, "g")) || []).length;
      const value = count * 5;

      chartElements.push({
        label: title,
        value: value,
        backgroundColor: colorPalette[i - 1]
      });
    }

    // 「多い順」が選ばれている場合は合計時間の大きい順に並べ替える（「標準」は工数区分の番号順のまま）
    if (selectedOrder === "多い順") {
      chartElements.sort((a, b) => b.value - a.value);
    }

    // 並べ替え後の順番で、棒グラフ用の配列に詰め替える
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

  // ---------- グラフの表示設定 ----------

  // 棒グラフ（Chart.js）の表示オプション
  const options = {
    responsive: true, // 外枠の大きさに合わせてグラフの大きさを変える
    maintainAspectRatio: false, // 縦横比を固定しない（外枠の高さいっぱいに描く）
    plugins: {
      // 凡例は非表示（工数区分名と色はグラフ下の一覧で表示するため）
      legend: {
        display: false,
      },
      // グラフタイトルは非表示
      title: {
        display: false,
      },
      // 各棒に表示する数値（chartjs-plugin-datalabels の設定）
      datalabels: {
        anchor: "end" as "end", // 数値の基準位置を棒の先端にする
        align: "start" as "start", // 基準位置から棒の内側寄りに表示する
        // 0分の工数区分は数値を表示しない
        formatter: (value: number) => {
          return value > 0 ? value.toString() : "";
        },
        color: '#ffffff', // 文字色: 白
        textStrokeColor: '#000000', // 文字の縁取り色: 黒（どの棒の色の上でも読めるようにする）
        textStrokeWidth: 2, // 縁取りの太さ
        // 文字サイズをグラフの幅に応じて変える（幅600px未満で10px、400px未満で8px、それ以外は12px）
        font: (context: any) => {
          const chartWidth = context.chart.width;
          let fontSize = 12;
          if (chartWidth < 600) {
            fontSize = 10;
          }
          if (chartWidth < 400) {
            fontSize = 8;
          }
          return {
            size: fontSize,
          };
        }
      },
    },
    scales: {
      // 横軸（工数区分名）
      x: {
        ticks: {
          autoSkip: false, // ラベルが混み合っても間引かず全工数区分名を表示する
          maxRotation: 90, // ラベルを90度回転させて縦書きにする（最大・最小とも90度に固定）
          minRotation: 90,
          // 文字サイズをグラフの幅に応じて変える（幅600px未満で10px、400px未満で8px、それ以外は12px）
          font: (context: any) => {
            const chartWidth = context.chart.width;
            let fontSize = 12;
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
      // 縦軸（合計時間）
      y: {
        beginAtZero: true, // 0から目盛りを始める
        // 縦軸の見出し
        title: {
          display: true,
          text: "工数（分）",
        },
      },
    },
  };

  // ---------- イベントハンドラ ----------

  /**
   * 日付欄の変更時に基準日を更新する（useEffect により自動で再取得される）。
   *
   * @param e - 日付入力欄の変更イベント
   * @returns なし
   */
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  /**
   * 期間の選択変更時に集計期間を更新する（useEffect により自動で再取得される）。
   *
   * @param e - 期間選択欄の変更イベント
   * @returns なし
   */
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(e.target.value);
  };

  /**
   * 並び順の選択変更時に並び順を更新する（再取得はせず、再描画時にグラフを並べ替える）。
   *
   * @param e - 並び順選択欄の変更イベント
   * @returns なし
   */
  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOrder(e.target.value);
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <Loading isLoading={true} />;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div className={styles.error}>{error}</div>;
  // データ未取得の場合はその旨だけを出す
  if (!apiData) return <div className={styles.noData}>データがありません。</div>;

  // 描画のたびに、現在のデータと並び順からグラフ用データを作る
  const chartData = processDataForChart(apiData);

  return (
    <div className={styles["kosu-total-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>工数集計</h1>
      {/* 工数メニュー画面へ戻るリンク */}
      <nav className={styles["kosu-nav"]}>
        <Link to="/kosu-menu">工数MENU</Link>
      </nav>
      {/* 集計条件の入力欄: 日付・期間・並び順 */}
      <div className={styles["kosu-total-form"]}>
        {/* 基準日の入力欄（変更すると再集計） */}
        <div className={styles["form-group"]}>
          <label htmlFor="date-picker">日付:</label>
          <input
            type="date"
            id="date-picker"
            value={selectedDate}
            onChange={handleDateChange}
            className={styles["date-picker-input"]}
          />
        </div>
        {/* 集計期間の選択欄: 日間 / 月間 / 年間（変更すると再集計） */}
        <div className={styles["form-group"]}>
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
        </div>
        {/* 並び順の選択欄: 標準（工数区分の番号順）/ 多い順 */}
        <div className={styles["form-group"]}>
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
      </div>
      {/* 工数区分ごとの合計時間の棒グラフ */}
      <div className={styles["chart-container"]}>
        <Bar data={chartData} options={options} />
      </div>
      {/* 集計結果の一覧: 工数区分1つにつき1行（色・工数区分名・合計時間）を表示（key には並び順の番号を使う） */}
      <div className={styles.chartDataList}>
        {chartData.chartElements.map((element, index) => (
          <div key={index} className={styles.dataListItem}>
            {/* グラフの棒と同じ色の四角 */}
            <span style={{ backgroundColor: element.backgroundColor }} className={styles.colorBox}></span>
            {/* 工数区分名 */}
            <span className={styles.itemLabel}>{element.label}</span>
            {/* 合計時間（分） */}
            <span className={styles.itemValue}>{element.value}分</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuTotal;