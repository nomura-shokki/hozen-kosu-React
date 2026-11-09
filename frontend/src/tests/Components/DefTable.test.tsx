/**
 * ============================================================
 * ファイル名 : DefTable.test.tsx
 * 種別       : テストコード（Vitest + React Testing Library）
 * テスト対象 : Components/DefTable.tsx（工数区分名と色の対応表＝凡例を表示する部品）
 * 概要       : 工数区分名が入っている kosu_title_N だけが表示されること、
 *              該当キーが無いと何も表示されないこと、各行に丸い色印が付くことを確認する。
 *
 * モック方針 :
 *   - styles/Components/DefTable.module.css : CSS Modules のクラス名を固定の文字列にして、
 *                                             テストからクラス名で要素を探せるようにするため
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest"; // toBeInTheDocument などの追加の検証関数を使えるようにする
import DefTable from "../../Components/DefTable";

// ============================================================
// モック定義
// ============================================================

// CSS Modules のモック: styles["クラス名"] が同じ文字列をそのまま返すようにする
// （本物はビルド時にクラス名へ固有の文字が付くため、テストから ".dataListItem" などで探せなくなる）
vi.mock("../../styles/Components/DefTable.module.css", () => ({
  default: {
    chartDataList: "chartDataList",
    dataListItem: "dataListItem",
    itemLabel: "itemLabel",
    "color-dot": "color-dot",
  },
}));

// ============================================================
// テスト本体
// ============================================================

// DefTable 部品の凡例表示を確認するテストグループ
describe("DefTable Component", () => {
  // 各テストの前に: モックの呼び出し履歴を消す
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 【テスト】kosu_title_ で始まり、工数区分名が入っているものが表示されること
  //   前提: 組立・検査・空欄・無関係なキーを含む工数区分定義データを渡す
  //   操作: 部品を表示する
  //   期待: 「組立」「検査」が表示される
  it("kosu_title_ キーの非空ラベルが表示されること", () => {
    // 準備: 工数区分定義データ（kosu_title_3 は空欄、other_key は対象外のキー）
    const defData = {
      kosu_title_1: "組立",
      kosu_title_2: "検査",
      kosu_title_3: "",
      other_key: "無関係",
    };
    // 操作: 部品を表示
    render(<DefTable defData={defData} />);
    // 検証: 工数区分名がある2件が表示される
    expect(screen.getByText("組立")).toBeInTheDocument();
    expect(screen.getByText("検査")).toBeInTheDocument();
  });

  // 【テスト】kosu_title_ で始まるキーが1つも無いときは凡例の行が表示されないこと
  //   前提: other_key だけを持つデータを渡す
  //   操作: 部品を表示する
  //   期待: 凡例1行分の要素（クラス dataListItem）が0個
  it("kosu_title_ キーが存在しない場合は何も表示されないこと", () => {
    // 準備: kosu_title_ で始まるキーが無いデータ
    const defData = { other_key: "無関係" };
    // 操作: 部品を表示（container は描画結果を包む DOM 要素）
    const { container } = render(<DefTable defData={defData} />);
    // 検証: 凡例の行が1つも無い
    const items = container.querySelectorAll(".dataListItem");
    expect(items).toHaveLength(0);
  });

  // 【テスト】各工数区分名の横に丸い色印が表示されること
  //   前提: 工数区分名が2件入ったデータを渡す
  //   操作: 部品を表示する
  //   期待: 色印（クラス color-dot）が2個あり、1つ目は border-radius 50%（円形）である
  it("各タイトルにカラードットが表示されること", () => {
    // 準備: 工数区分名が2件のデータ
    const defData = {
      kosu_title_1: "組立",
      kosu_title_2: "検査",
    };
    // 操作: 部品を表示
    const { container } = render(<DefTable defData={defData} />);
    // 検証: 色印が工数区分の数（2個）だけあり、円形のスタイルが付いている
    const dots = container.querySelectorAll(".color-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveStyle({ borderRadius: "50%" });
  });
});
