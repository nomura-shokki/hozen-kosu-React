/**
 * ============================================================
 * ファイル名 : KosuBarChart.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/KosuBarChart.tsx（作業内容を工数区分ごとに色分けした棒グラフ部品）
 * 概要       : 直（1〜6・不明値）とショップ（組立系 / それ以外）の組み合わせや、作業内容の中身
 *              （null・小文字混在・全て未入力）を変えても、エラーにならず棒グラフが描画されることを確認する。
 *              ※各テストは描画されたかどうかだけを確認し、グラフの中身（ラベル数・データ数）は確認しない。
 *
 * モック方針 :
 *   - react-chartjs-2 の Bar : 実際の Canvas 描画をさせず、目印（data-testid）付きの canvas 要素にするため
 *   - chart.js               : グラフ部品の登録処理（Chart.register）などを何もしない偽物にするため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { vi, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする

// ============================================================
// モック定義
// ============================================================

// react-chartjs-2 の Bar（棒グラフ部品）のモック:
// data-testid="bar-chart" の canvas を出すだけにする。
// 受け取った横軸ラベルの個数を data-labels、データの個数を data-data 属性に書き出す
// （このファイルのテストではこの2つの属性はまだ確認していない）
vi.mock("react-chartjs-2", () => ({
  Bar: (props: any) => <canvas data-testid="bar-chart" data-labels={JSON.stringify(props.data?.labels?.length)} data-data={JSON.stringify(props.data?.datasets?.[0]?.data?.length)} />,
}));

// chart.js のモック: Chart.register は何もしない偽の関数、各グラフ部品は空のクラスにする
vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
}));

// テスト対象のコンポーネント
// （vi.mock はファイル先頭へ自動的に巻き上げられるため、ここで読み込んでもモックが適用される）
import KosuBarChart from "../../Components/KosuBarChart";

// ============================================================
// テスト本体
// ============================================================

// 作業内容（time_work）は 288文字 = 24時間 × 12コマ（1コマ5分）。
// 英字1文字が工数区分（"A" = 1番目 …）、"#" は未入力を表す。
// 直とショップの組み合わせごとに、グラフの左端（開始時刻）を決める分岐が変わる。

// KosuBarChart 部品が様々な入力で描画できることを確認するテストグループ
describe("KosuBarChart", () => {
  // 【テスト】1直の作業内容で棒グラフが描画されること
  //   前提: 作業内容は全て "A"（1番目の工数区分）、直 "1"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフ（data-testid="bar-chart"）が存在する（1直はグラフが 04:30 始まりになる分岐）
  it("renders a Bar chart with valid data for tyoku 1", () => {
    // 準備: 288コマすべて工数区分 A の作業内容
    const timeWork = "A".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="1" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】作業内容が null でもエラーにならず棒グラフが描画されること
  //   前提: 作業内容は null、直 "1"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（データは空配列として扱われる）
  it("renders with null initialTimeWork", () => {
    // 操作: 作業内容 null で部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={null} tyoku="1" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系ショップ（W1）で棒グラフが描画されること
  //   前提: 作業内容は全て "B"、直 "2"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（2直・組立系はグラフが 08:50 始まりになる分岐）
  it("renders with tyoku 2 and W1 shop", () => {
    // 準備: 288コマすべて工数区分 B の作業内容
    const timeWork = "B".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系以外のショップ（P）で棒グラフが描画されること
  //   前提: 作業内容は全て "C"、直 "2"、ショップ P
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（2直・組立系以外はグラフが 11:50 始まりになる分岐）
  it("renders with tyoku 2 and non-W shop", () => {
    // 準備: 288コマすべて工数区分 C の作業内容
    const timeWork = "C".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="P" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】3直・組立系ショップ（W2）で棒グラフが描画されること
  //   前提: 作業内容は全て "D"、直 "3"、ショップ W2
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（3直・組立系はグラフが 17:50 始まりになる分岐）
  it("renders with tyoku 3 and W2 shop", () => {
    // 準備: 288コマすべて工数区分 D の作業内容
    const timeWork = "D".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="3" shop="W2" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】3直・組立系以外のショップ（P）で棒グラフが描画されること
  //   前提: 作業内容は全て "E"、直 "3"、ショップ P
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（3直・組立系以外はグラフが 20:25 始まりになる分岐）
  it("renders with tyoku 3 and non-W shop", () => {
    // 準備: 288コマすべて工数区分 E の作業内容
    const timeWork = "E".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="3" shop="P" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】常昼（直 "4"）で棒グラフが描画されること
  //   前提: 作業内容は全て "F"、直 "4"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（常昼はグラフが 06:00 始まりになる分岐）
  it("renders with tyoku 4", () => {
    // 準備: 288コマすべて工数区分 F の作業内容
    const timeWork = "F".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="4" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】連1直（直 "5"）で棒グラフが描画されること
  //   前提: 作業内容は全て "G"、直 "5"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（連1直はグラフが 04:30 始まりになる分岐）
  it("renders with tyoku 5", () => {
    // 準備: 288コマすべて工数区分 G の作業内容
    const timeWork = "G".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="5" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】連2直（直 "6"）で棒グラフが描画されること
  //   前提: 作業内容は全て "H"、直 "6"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（連2直はグラフが 15:10 始まりになる分岐）
  it("renders with tyoku 6", () => {
    // 準備: 288コマすべて工数区分 H の作業内容
    const timeWork = "H".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="6" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】存在しない直の値でも棒グラフが描画されること
  //   前提: 作業内容は全て "A"、直 "9"（1〜6 以外）、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（並べ替えをせず 00:00 始まりのままになる分岐）
  it("renders with unknown tyoku (default labels)", () => {
    // 準備: 288コマすべて工数区分 A の作業内容
    const timeWork = "A".repeat(288);
    // 操作: 想定外の直 "9" で部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="9" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】大文字・小文字の記号と未入力 "#" が混ざった作業内容でも棒グラフが描画されること
  //   前提: 作業内容は "AaBbCc" の後に "#" が282個（合計288文字）、直 "1"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（小文字も大文字と同じ番号に変換され、"#" は 0 になる）
  it("handles mixed characters including lowercase", () => {
    // 準備: 先頭6コマだけ工数区分の記号、残りは未入力の作業内容
    const timeWork = "AaBbCc" + "#".repeat(282);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="1" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】作業内容がすべて未入力（"#"）でも棒グラフが描画されること
  //   前提: 作業内容は "#" が288個、直 "1"、ショップ W1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（全コマが 0 のため、先頭側の切り詰め処理は行われない）
  it("handles all-hash (empty) data", () => {
    // 準備: 288コマすべて未入力の作業内容
    const timeWork = "#".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="1" shop="W1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系ショップ（A1）で棒グラフが描画されること
  //   前提: 作業内容は全て "A"、直 "2"、ショップ A1
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（A1 も組立系として 08:50 始まりの分岐に入る）
  it("renders with A1 shop for tyoku 2", () => {
    // 準備: 288コマすべて工数区分 A の作業内容
    const timeWork = "A".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="A1" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】3直・組立系ショップ（A2）で棒グラフが描画されること
  //   前提: 作業内容は全て "A"、直 "3"、ショップ A2
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（A2 も組立系として 17:50 始まりの分岐に入る）
  it("renders with A2 shop for tyoku 3", () => {
    // 準備: 288コマすべて工数区分 A の作業内容
    const timeWork = "A".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="3" shop="A2" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });

  // 【テスト】2直・組立系ショップ（J）で棒グラフが描画されること
  //   前提: 作業内容は全て "A"、直 "2"、ショップ J
  //   操作: 部品を表示する
  //   期待: 棒グラフが存在する（J も組立系として 08:50 始まりの分岐に入る）
  it("renders with J shop for tyoku 2", () => {
    // 準備: 288コマすべて工数区分 A の作業内容
    const timeWork = "A".repeat(288);
    // 操作: 部品を表示
    const { getByTestId } = render(
      <KosuBarChart initialTimeWork={timeWork} tyoku="2" shop="J" />
    );
    // 検証: 棒グラフが描画されている
    expect(getByTestId("bar-chart")).toBeInTheDocument();
  });
});
