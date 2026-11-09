/**
 * ============================================================
 * ファイル名 : KosuBarChart.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 1日分の作業内容（time_work: 5分ごとの工数区分記号を288文字並べた文字列）を、
 *              工数区分ごとに色分けした棒グラフ（タイムライン）として表示する部品。
 *
 * 主な機能   :
 *   - 作業内容の各文字（5分1コマ）を1本の棒にし、工数区分に応じた色で塗る
 *   - 直・ショップに応じてグラフの左端の時刻を変え、日をまたぐ勤務も一続きに表示する
 *   - 作業のない前後の時間帯を切り詰めて、作業のある時間帯を中心に表示する
 *
 * 使用箇所   : KosuPage/KosuNew.tsx（工数入力画面）, KosuPage/KosuEdit.tsx（工数編集画面）,
 *              KosuPage/KosuDelete.tsx（工数削除画面）, TeamPage/TeamDetail.tsx（班員工数履歴詳細画面）
 * 関連ファイル: styles/Components/KosuBarChart.module.css,
 *              Components/DefTable.tsx（色と工数区分名の凡例）, Components/KosuDisplay.tsx（同じデータの表形式表示）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from "react";
import { Bar } from "react-chartjs-2"; // Chart.js を React で使うための棒グラフ部品
import styles from "../styles/Components/KosuBarChart.module.css";
// Chart.js 本体と、棒グラフの描画に必要な部品（軸・棒・タイトル・ツールチップ・凡例）
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
// （Chart.js v3以降は、使う部品を事前に登録しないとグラフが描画できない仕組みのため）
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ============================================================
// 型定義
// ============================================================

/** KosuBarChart が親コンポーネントから受け取る props（部品に渡す設定値） */
interface Props {
  initialTimeWork: string | null; // 作業内容（288文字。1文字=5分。英字=工数区分、"$"=休憩、"#"=未入力）。nullの場合もある
  tyoku: string; // 直の番号（"1"〜"6"）。グラフの左端の時刻を決めるのに使う
  shop: string; // ショップ。2直・3直のときは組立系（W1/W2/A1/A2/J/組長以上(W,A)）かどうかで左端の時刻が変わる
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 作業内容の文字列を、1文字ずつ数値に変換した配列にする。
 *
 * 英字の記号を「何番目の工数区分か」を表す数値に変換し、グラフの色を決めるのに使う。
 * 休憩（"$"）や未入力（"#"）など英字以外は 0 になる（0 は棒を描かない）。
 *
 * @param input - 作業内容の文字列（例: "##AAB$$"）。null や空文字も可
 * @returns 各文字に対応する数値の配列（例: "##AAB$$" → [0, 0, 1, 1, 2, 0, 0]）。入力が空なら空配列
 */
const convertToData = (input: string | null): number[] => {
  if (!input) return []; // 入力がnullの場合、空の配列を返す

  // A〜Zおよびa〜zを数値にマッピングする対応表を作る
  const charMap: { [key: string]: number } = {};
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("").forEach((char, index) => {
    // 26で割った余り + 1 にするため、大文字・小文字に関係なく1〜26にマッピングされる
    // （例: "A" → 1、"Z" → 26、"a" → 1、"b" → 2）
    charMap[char] = (index % 26) + 1; // 大文字・小文字に関係なく1〜26にマッピング
  });

  // 入力文字列の各文字を数値に変換
  return input.split("").map((char) => charMap[char] || 0); // 変換できない文字は0にする
};

/**
 * グラフの横軸ラベルを作る（1日を5分間隔に区切ったタイムスロット）。
 *
 * 1日 = 24時間 × 12コマ（1時間に5分が12個）= 288コマ。作業内容の1文字と1対1で対応する。
 *
 * @returns "HH:MM" 形式の時刻ラベル288個の配列（"00:00", "00:05", …, "23:55"）
 */
const generateTimeLabels = () => {
  const labels: string[] = [];
  // i 番目のコマは 0:00 から i × 5 分後の時刻を表す
  for (let i = 0; i < 288; i++) {
    const hours = Math.floor(i * 5 / 60).toString().padStart(2, "0"); // 時間を計算しゼロ埋め（例: 9 → "09"）
    const minutes = (i * 5 % 60).toString().padStart(2, "0"); // 分を計算しゼロ埋め
    labels.push(`${hours}:${minutes}`); // 時間:分としてラベルを生成
  }
  return labels; // 時間ラベルの配列を返す
};

/**
 * 工数区分ごとの表示色を50色ぶん作る。
 *
 * 色相（hue: 色の種類を0〜360度の角度で表す値）を7度ずつずらした HSL 形式の色を並べる。
 * DefTable.tsx の同名関数と同じ計算にして、凡例の色とグラフの色をそろえている。
 *
 * @returns 色文字列の配列（例: ["hsl(0, 70%, 50%)", "hsl(7, 70%, 50%)", …] の50要素）
 */
const generateColorPalette = (): string[] => {
  const colors = [];
  // 360度を50色で分けた間隔（360 / 50 = 7.2 を切り捨てて 7度）
  const step = Math.floor(360 / 50);
  // 工数区分の最大数（50区分）ぶんの色を作る
  for (let i = 0; i < 50; i++) {
    colors.push(`hsl(${(i * step) % 360}, 70%, 50%)`);
  }
  return colors;
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 作業内容を工数区分ごとに色分けした棒グラフで表示する。
 *
 * 処理の流れ:
 *   1. 作業内容を数値配列に、時刻ラベル（288個）と色パレット（50色）を用意する
 *   2. 直・ショップに応じて、グラフの左端にする時刻から始まるようにデータとラベルを並べ替える
 *   3. 作業のない末尾・先頭の時間帯を切り詰める
 *   4. Chart.js 用のデータと表示設定を組み立てて描画する
 * 棒の高さはすべて同じ（縦軸の最大値を1に固定）で、色だけで工数区分を区別する。
 *
 * @param props - Props を参照
 * @returns 棒グラフのJSX
 */
const KosuBarChart: React.FC<Props> = ({ initialTimeWork, tyoku, shop }) => {
  // ---------- グラフの元データを用意 ----------
  const chartData = convertToData(initialTimeWork); // 5分ごとの工数区分番号（0=作業なし）
  const colorPalette = generateColorPalette(); // 工数区分の番号 → 色 の対応（番号1 → 0番目の色）
  const originalLabels = generateTimeLabels(); // 00:00 始まりの時刻ラベル288個

  // ---------- 直に応じてグラフの開始時刻をずらす ----------

  // 時刻ラベルを「直ごとの開始位置から後ろ」+「先頭から開始位置の手前」の順に並べ替える（配列の回転）。
  // これにより、日付をまたぐ勤務（夜〜翌朝）も 0:00 で途切れず一続きに表示される。
  // 開始位置の数値はコマ番号（1コマ=5分）で、時刻に直すと次のとおり:
  //   1直: 54 → 04:30 / 2直（組立系）: 106 → 08:50 / 2直（その他）: 142 → 11:50
  //   3直（組立系）: 214 → 17:50 / 3直（その他）: 245 → 20:25
  //   常昼(4): 72 → 06:00 / 連1直(5): 54 → 04:30 / 連2直(6): 182 → 15:10
  //   上記以外（直が空など）: 並べ替えず 00:00 始まり
  // 組立系 = ショップが W1 / W2 / A1 / A2 / J / 組長以上(W,A) のいずれか
  const labels =
    tyoku === "1"
      ? [...originalLabels.slice(54), ...originalLabels.slice(0, 54)]
      : tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...originalLabels.slice(106), ...originalLabels.slice(0, 106)]
      : tyoku === "2"
      ? [...originalLabels.slice(142), ...originalLabels.slice(0, 142)]
      : tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...originalLabels.slice(214), ...originalLabels.slice(0, 214)]
      : tyoku === "3"
      ? [...originalLabels.slice(245), ...originalLabels.slice(0, 245)]
      : tyoku === "4"
      ? [...originalLabels.slice(72), ...originalLabels.slice(0, 72)]
      : tyoku === "5"
      ? [...originalLabels.slice(54), ...originalLabels.slice(0, 54)]
      : tyoku === "6"
      ? [...originalLabels.slice(182), ...originalLabels.slice(0, 182)]
      : originalLabels;

  // データ側もラベルとまったく同じ規則で並べ替え、時刻と値の対応を保つ
  // （後続の処理で切り詰めるため let で宣言している）
  let chartDataModified =
    tyoku === "1"
      ? [...chartData.slice(54), ...chartData.slice(0, 54)]
      : tyoku === "2" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...chartData.slice(106), ...chartData.slice(0, 106)]
      : tyoku === "2"
      ? [...chartData.slice(142), ...chartData.slice(0, 142)]
      : tyoku === "3" && (shop === "W1" || shop === "W2" || shop === "A1" || shop === "A2" || shop === "J" || shop === "組長以上(W,A)")
      ? [...chartData.slice(214), ...chartData.slice(0, 214)]
      : tyoku === "3"
      ? [...chartData.slice(245), ...chartData.slice(0, 245)]
      : tyoku === "4"
      ? [...chartData.slice(72), ...chartData.slice(0, 72)]
      : tyoku === "5"
      ? [...chartData.slice(54), ...chartData.slice(0, 54)]
      : tyoku === "6"
      ? [...chartData.slice(182), ...chartData.slice(0, 182)]
      : chartData;

  // ---------- 作業のない時間帯を切り詰める ----------

  // 後ろから探索して0以外の値（最後に作業がある位置）が出た位置を取得
  let lastNonZeroIndex = chartDataModified.length - 1;
  while (lastNonZeroIndex >= 0 && chartDataModified[lastNonZeroIndex] === 0) {
    lastNonZeroIndex--;
  }

  // 削除対象の範囲を計算（ただし130要素より前は削除しない）
  // 最後の作業の次の1コマまでを残す（slice の終了位置は含まれないため +2）。
  // 最低でも先頭から130コマ（= 650分 = 10時間50分）は残し、グラフが短くなりすぎないようにする
  const removeEndIndex = Math.max(lastNonZeroIndex + 2, 130);
  chartDataModified = chartDataModified.slice(0, removeEndIndex);

  // 前方から探索して0以外の値（最初に作業がある位置）が出た最初の位置を取得
  let firstNonZeroIndex = 0;
  while (firstNonZeroIndex < chartDataModified.length && chartDataModified[firstNonZeroIndex] === 0) {
    firstNonZeroIndex++;
  }

  // データがすべて0でない場合のみ切り捨て処理を行う
  // （すべて0のときは firstNonZeroIndex が配列の長さと等しくなり、この処理は行われない）
  if (firstNonZeroIndex < chartDataModified.length) {
    // 削除対象の範囲を計算（ただし0より前は削除しない）
    // 最初の作業の2コマ（10分）手前から表示する
    const removeStartIndex = Math.max(firstNonZeroIndex - 2, 0);
    chartDataModified = chartDataModified.slice(removeStartIndex);

    // ラベルもchartDataModifiedの長さに合わせて切り詰める
    // 先頭を同じ数だけ削除し、配列の長さを直接書き換えて末尾も同じ位置で切る
    labels.splice(0, removeStartIndex);
    labels.length = chartDataModified.length;
  }

  // ---------- Chart.js に渡すデータ ----------

  // labels: 横軸の時刻 / datasets: 棒グラフのデータ（1系列のみ）
  const data = {
    labels,
    datasets: [
      {
        label: "作業時間データ", // 系列名（凡例は非表示。ツールチップに表示される）
        data: chartDataModified, // 各コマの工数区分番号（0 は高さ0なので棒が見えない）
        // 棒の塗り色: 工数区分番号 N → 色パレットの N-1 番目。番号0（作業なし）は該当色がないため灰色
        backgroundColor: chartDataModified.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 0.6)"),
        // 棒の枠線色: 塗り色と同じ規則（灰色だけ不透明）
        borderColor: chartDataModified.map((value) => colorPalette[value - 1] || "rgba(200, 200, 200, 1)"),
        borderWidth: 1, // 枠線の太さ（px）
        // 棒の幅を目盛り間隔いっぱいにして、隣の棒との隙間をなくす（帯状のタイムラインに見せる）
        barPercentage: 1,
        categoryPercentage: 1,
      },
    ],
  };

  // ---------- Chart.js の表示設定 ----------

  // 末尾の as const は、'category' などの文字列を Chart.js の型定義が求める
  // 固定の文字列型として TypeScript に扱わせるためのもの
  const options = {
    responsive: true, // 親要素の幅に合わせて自動で大きさを変える
    maintainAspectRatio: false, // 縦横比を固定しない（高さは CSS 側の指定に従う）
    plugins: {
      // 凡例（系列名の表示）は出さない（工数区分の凡例は DefTable.tsx が別に表示する）
      legend: {
        display: false,
      },
      // グラフタイトルは出さない
      title: {
        display: false,
      },
      // 棒の上の数値ラベル（chartjs-plugin-datalabels 用の設定）を出さない
      datalabels: {
        display: false,
      },
    },
    scales: {
      // 縦軸: 最大値を1に固定し、値1以上の棒はすべて同じ高さにする。目盛りと補助線は非表示
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
      // 横軸: 時刻ラベルを項目として並べる軸。棒の幅は隙間なく自動調整する
      x: {
        type: 'category',
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        barThickness: 'flex',
      },
    },
  } as const;

  // ---------- 描画（JSX） ----------

  // グラフの大きさは CSS の chart-container クラスで決める
  return (
    <div className={styles["chart-container"]}>
      <Bar data={data} options={options} />
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuBarChart;