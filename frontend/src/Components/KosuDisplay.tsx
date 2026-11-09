/**
 * ============================================================
 * ファイル名 : KosuDisplay.tsx
 * 種別       : 共通部品コンポーネント
 * 概要       : 1日分の作業内容（time_work）と作業詳細（detail_work）を、
 *              「作業時間 / 作業内容 / 作業詳細」の3列の表に変換して表示する部品。
 *              表の最終行には、工数の合計時間と基準時間（就業形態ごとの本来あるべき合計）を出す。
 *
 * 主な機能   :
 *   - 5分ごとの記号の並びを、同じ作業が続く時間帯ごとの1行にまとめる（例: 08:00～10:30 / 組立 / 〇〇）
 *   - 直・ショップに応じて表の開始時刻を変え、日をまたぐ勤務も一続きに表示する
 *   - 工数合計（休憩・未入力を除いた分数）と基準合計工数を表示する
 *   - 画面の高さ・表の幅に合わせて外枠の大きさを調整する
 *
 * 使用箇所   : KosuPage/KosuNew.tsx（工数入力画面）, KosuPage/KosuDelete.tsx（工数削除画面）,
 *              TeamPage/TeamDetail.tsx（班員工数履歴詳細画面）
 * 関連ファイル: styles/Components/KosuDisplay.module.css,
 *              Components/KosuBarChart.tsx（同じデータのグラフ表示）,
 *              kosu/utils/kosu_utils.py（judgement_check: 基準合計工数と同じ値で工数入力OK/NG判定を行う）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/Components/KosuDisplay.module.css";

// ============================================================
// 型定義
// ============================================================

/** KosuDisplay が親コンポーネントから受け取る props（部品に渡す設定値） */
interface KosuDisplayProps {
  timeWork: string; // 作業内容（288文字。1文字=5分。英字=工数区分、"$"=休憩、"#"=未入力）
  workDetail: string; // 作業詳細（5分ごとの詳細文字列を "$" で区切って288個つないだ文字列）
  updatedAt: Date; // データの更新日時（データの変更を検知するために使用。値が変わると表を作り直す）
  defData: { [key: string]: string | undefined }; // 作業コードとタイトルのマッピングデータ（工数区分定義データ。kosu_title_1〜50 に工数区分名）
  tyoku: string; // 勤務シフト＝直（例: "1", "2" など。"1"〜"6"）
  shop: string; // 部署・ショップ情報（特定のシフトの調整と基準合計工数の判定に使用）
  work?: string; // 勤務＝就業形態（出勤・休出・半前年休 など。基準合計工数の判定に使用）
  headerColor?: string; // 表の見出し行の背景色（例: "#0ff"）。省略時は CSS の指定どおり
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 作業内容・作業詳細を時間帯ごとの表にして表示する。
 *
 * 処理の流れ:
 *   1. 作業内容・作業詳細が変わるたびに、5分ごとのデータを「同じ作業が続く時間帯」単位に
 *      まとめ直して parsedData に保存する（useEffect）
 *   2. 画面の高さ・表の幅を測って外枠の大きさに反映する（useEffect）
 *   3. 工数合計と基準合計工数を計算し、表の最終行に表示する
 *
 * @param props - KosuDisplayProps を参照
 * @returns 作業内容一覧表のJSX
 */
const KosuDisplay: React.FC<KosuDisplayProps> = ({ timeWork, workDetail, updatedAt, defData, tyoku, shop, work, headerColor }) => {
  // ---------- state（画面の状態） ----------

  // パースされたデータ（表の1行 = 1つの時間帯）を格納するステート
  //   time: "HH:MM～HH:MM" / work: 工数区分名（または "休憩"） / detail: 作業詳細
  const [parsedData, setParsedData] = useState<{ time: string; work: string; detail: string }[]>([]);
  // テーブルの大きさ測定
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 外枠の最大の高さ（px）。ブラウザ表示領域の高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // 表（table要素）の実際の幅（px）
  const tableRef = useRef<HTMLTableElement>(null); // 幅を測るために table 要素を参照する

  // ---------- 副作用（useEffect） ----------

  // 作業内容・作業詳細・更新日時・工数区分定義・直・ショップのいずれかが変わったとき:
  // 表に表示する行データを作り直す（初回表示時も実行される）
  // ※呼び出し側の画面は updatedAt に描画のたびに new Date() を渡しているため、
  //   実際には親画面が再描画されるたびに作り直される
  useEffect(() => {
    /**
     * 作業内容と作業詳細を解析し、同じ作業が続く時間帯ごとの行データ配列にする。
     *
     * 1文字（5分）ずつ見ていき、工数区分または作業詳細が変わった位置で行を区切る。
     * 未入力（"#"）の位置と文字列の終わりでも行を区切る（未入力の時間帯は行にしない）。
     *
     * @returns 行データの配列（例: [{ time: "08:00～10:30", work: "組立", detail: "〇〇" }, …]）
     */
    const parseTimeWorkAndDetail = () => {
      // defDataから`kosu_title_`で始まるキーを取り出し、
      // 「記号 → 工数区分名」の対応表を作る（kosu_title_1 → "A"、kosu_title_27 → "a" …）
      // 工数区分名が無い場合は null を入れる
      const kosuTitleMapping = Object.keys(defData)
        .filter((key) => key.startsWith("kosu_title_"))
        .reduce((acc, key, index) => {
          acc["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"[index]] = defData[key] ?? null;
          return acc;
        }, {} as Record<string, string | null>);

      /**
       * 勤務シフト（直）に応じて時間文字列の範囲を調整する（開始時刻をずらす）ヘルパー関数。
       *
       * 288コマの文字列を2回つなげて576コマにし、start 番目から 288コマ分を切り出す。
       * これで「start の時刻から翌日の同じ時刻の手前まで」の並びになり、日をまたぐ勤務も途切れない。
       *
       * @param start - 切り出し開始位置（コマ番号。1コマ=5分。例: 54 → 04:30）
       * @param end   - つなげた文字列の末尾から削るコマ数（start + end = 288 で24時間分が残る）
       * @returns adjustedTimeWork: 並べ替えた作業内容 / splitDetails: 同じく並べ替えた作業詳細の配列
       */
      const adjustRange = (start: number, end: number) => ({
        // timeWorkを2回繰り返して、指定された開始・終了オフセットで切り取る
        adjustedTimeWork: timeWork.repeat(2).slice(start, timeWork.length * 2 - end),
        // workDetailを "$" で分割した配列を2回つなげて、同じ開始・終了オフセットで切り取る
        splitDetails: workDetail.split("$").concat(workDetail.split("$")).slice(start, workDetail.split("$").length * 2 - end)
      });

      // 勤務シフトごとの調整範囲を定義（start をコマ番号から時刻に直した値も併記）
      //   "1": 1直 04:30〜 / "2W_A": 2直・組立系 08:50〜 / "2": 2直・その他 11:50〜
      //   "3W_A": 3直・組立系 17:50〜 / "3": 3直・その他 20:25〜 / "4": 常昼 06:00〜 / "6": 連2直 15:10〜
      // ※"5"（連1直）は定義がないため並べ替えず 00:00 から表示する
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
      // 2直・3直で、ショップが組立系（W1/W2/A1/A2/J/組長以上(W,A)）なら直の番号の後ろに "W_A" を付ける
      // （例: 2直 + W1 → "2W_A"、2直 + P → "2"、1直 + W1 → "1"）
      const rangeKey = tyoku + ((tyoku === "2" || tyoku === "3") && (["W1", "W2", "A1", "A2", "J", "組長以上(W,A)"].includes(shop)) ? "W_A" : "");

      // 適切な調整範囲が定義されていれば適用、そうでなければ元の文字列を使用
      const { adjustedTimeWork, splitDetails } = ranges[rangeKey]
        ? adjustRange(ranges[rangeKey].start, ranges[rangeKey].end)
        : { adjustedTimeWork: timeWork, splitDetails: workDetail.split("$") };

      // パース結果を格納する配列
      const result: { time: string; work: string; detail: string }[] = [];     
      // 現在の作業内容、詳細、開始インデックスを追跡する変数
      //   currentWork / currentDetail: いま続いている時間帯の工数区分名・作業詳細（"" は何もない状態）
      //   startIndex: その時間帯が始まったコマ番号（-1 は時間帯なし）
      let currentWork = "", currentDetail = "", startIndex = -1;

      /**
       * いま続いている時間帯を1行として result に追加するヘルパー関数。
       *
       * 作業内容も作業詳細も空のとき（未入力が続いていた場合など）は何も追加しない。
       *
       * @param i      - 時間帯が終わった位置（このコマは含まない）
       * @param offset - adjustRange でずらしたコマ数。元の時刻に戻すために足す
       * @returns なし（result 配列に追加する）
       */
      const pushResult = (i: number, offset: number) => {
        if (currentWork || currentDetail) {
          // 開始時間と終了時間を計算
          // 1時間 = 12コマ なので「コマ番号 ÷ 12」が時、「余り × 5」が分。
          // ずらした結果 288 以上になることがあるため、時は 24 で割った余りにする
          // （例: コマ番号 300 → 25時 → 1時）
          const startHour = Math.floor((startIndex + offset) / 12) % 24;
          const startMinute = ((startIndex + offset) % 12) * 5;
          const endHour = Math.floor((i + offset) / 12) % 24;
          const endMinute = ((i + offset) % 12) * 5;
          // 時間範囲の文字列をフォーマット（例: "08:00～10:30"。1桁の数字は先頭を0で埋める）
          const timeRange = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}～${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
          // 結果配列にプッシュ
          result.push({ time: timeRange, work: currentWork, detail: currentDetail });
        }
      };

      // adjustedTimeWork文字列を1文字ずつループ
      // （i が文字列の長さと等しい最後の1回は文字が無い＝終端として扱い、最後の時間帯を確定させる）
      for (let i = 0; i <= adjustedTimeWork.length; i++) {
        const charWork = adjustedTimeWork[i]; // 時間・作業コードの現在の文字
        const mappedWork = charWork === "$" ? "休憩" : kosuTitleMapping[charWork]; // コードを対応する作業内容にマッピング
        // 対応する作業詳細を取得
        // 作業内容と作業詳細の個数の比で位置を合わせる（通常はどちらも288個なので i 番目そのもの）
        const charDetail = splitDetails[Math.floor(i / (adjustedTimeWork.length / splitDetails.length))] ?? "";

        // `#`（未入力） または文字列の終端で現在のセッション（続いている時間帯）を終了
        if (charWork === "#" || charWork === undefined) {
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = "";
          currentDetail = "";
          startIndex = -1;
        } else if (mappedWork !== currentWork || charDetail !== currentDetail) {
          // 作業内容または詳細が変更された場合に、前のセッションを終了し、新しいセッションを開始
          pushResult(i, ranges[rangeKey]?.start ?? 0);
          currentWork = mappedWork || charWork; // マッピングされた作業内容、または（工数区分名が無ければ）元の文字
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
  // 依存配列が空なので、表示時に1回だけ登録し、画面から消えるときに解除する
  useEffect(() => {
    const updateMaxHeight = () => setMaxHeight(window.innerHeight);
    updateMaxHeight(); // 初回レンダリング時にも実行
    window.addEventListener("resize", updateMaxHeight); // リサイズイベントリスナーを追加
    return () => window.removeEventListener("resize", updateMaxHeight); // クリーンアップ関数（登録したリスナーを解除）
  }, []); // 空の依存配列は、コンポーネントのマウント時とアンマウント時にのみ実行

  // `parsedData`が変更された時にテーブルの幅を更新するエフェクト
  // 行の内容が変わると表の幅も変わるため、そのたびに測り直す（ウィンドウのリサイズ時も測り直す）
  useEffect(() => {
    const updateTableWidth = () => {
      // 表が描画済みなら、実際の表示幅（px）を取得して保存する
      if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
    };
    updateTableWidth(); // 初回レンダリング時とデータ更新時に実行
    window.addEventListener("resize", updateTableWidth); // リサイズイベントリスナーを追加
    return () => window.removeEventListener("resize", updateTableWidth); // クリーンアップ関数（前回登録したリスナーを解除）
  }, [parsedData]); // `parsedData`が変更されたら再実行

  // ---------- 表示用の値の計算 ----------

  // 見出しセルに付けるインラインスタイル（背景色を画面ごとに変えるため）
  const headerStyle = { backgroundColor: headerColor }

  // 合計時間を計算 (#と$を除いた文字数 * 5分)
  // 正規表現 /[#$]/g は「# または $ をすべて」の意味。それらを消した残りが工数区分の入ったコマ数
  const totalMinutes = timeWork.replace(/[#$]/g, "").length * 5;

  /**
   * 基準合計工数作成関数（Pythonロジックの移植）。
   *
   * 就業形態・ショップ・直から、その日の工数合計の基準値（分）を決める。
   * 値は kosu/utils/kosu_utils.py の judgement_check（工数入力OK/NG判定）で使う基準値と同じ。
   * ショップは2グループに分けて判定する:
   *   P/R/T系  : P, R, T1, T2, その他, 組長以上(P,R,T,その他)
   *   組立系   : W1, W2, A1, A2, J, 組長以上(W,A)
   *
   * @returns 基準合計工数（分）。どの条件にも当たらない場合（休日・年休など）は 0、
   *          就業形態が '遅刻・早退' の場合は '-'（基準なし）
   */
  const getDefaultTotal = () => {
    let default_total: string | number = 0;
    const shopP_R_T = ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)']; // P/R/T系ショップ
    const shopW_A = ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)']; // 組立系ショップ

    // 直・ショップに関係なく決まる就業形態
    //   出勤・シフト出: 470分（7時間50分） / 休出: 0分 / 出勤(時短なし): 480分（8時間）
    //   半前年休・半後年休(時短なし): 240分（4時間）
    // ※WorkSelect.tsx・kosu_utils.py の選択肢は '早退・遅刻' であり、ここで比べている '遅刻・早退' とは文字の順番が違う
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
    // P/R/T系ショップの半前年休・半後年休（1直: 220/250分、2直: 230/240分、3直: 275/195分）
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
    // 組立系ショップの半前年休・半後年休（1直: 230/240分、2直: 290/180分、3直: 230/240分）
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
    // 常昼（ショップ問わず）の半前年休・半後年休: 230/240分
    } else if (tyoku === '4' && work === '半前年休') {
      default_total = 230;
    } else if (tyoku === '4' && work === '半後年休') {
      default_total = 240;
    // 連1直・連2直（ショップ問わず）の半前年休・半後年休: 220/250分
    } else if ((tyoku === '5' || tyoku === '6') && work === '半前年休') {
      default_total = 220;
    } else if ((tyoku === '5' || tyoku === '6') && work === '半後年休') {
      default_total = 250;
    }

    return default_total;
  };

  // 表の最終行に表示する基準合計工数
  const defaultTotal = getDefaultTotal();

  // ---------- 描画（JSX） ----------

  // 外枠: 高さはブラウザ表示領域まで（超えたら縦スクロール）、
  // 幅は表の幅 + 15px（縦スクロールバーが出ても表が押し縮められないよう余裕を持たせる）
  return (
    <div className={styles["table-wrapper"]} style={{ maxHeight: `${maxHeight}px`, overflowY: "auto", width: `${tableWidth + 15}px` }}>
      {/* 幅を測るため table 要素に ref を付ける */}
      <table ref={tableRef}>
        {/* 見出し行（背景色は headerColor で指定） */}
        <thead>
          <tr>
            <th style={headerStyle}>作業時間</th>
            <th style={headerStyle}>作業内容</th>
            <th style={headerStyle}>作業詳細</th>
          </tr>
        </thead>
        <tbody>
          {/* 解析済みの時間帯1つにつき1行を表示（key には並び順の番号を使う） */}
          {parsedData.map((item, index) => (
            <React.Fragment key={index}>
              <tr>
                <td>{item.time}</td>
                <td>{item.work}</td>
                <td>{item.detail}</td>
              </tr>
            </React.Fragment>
          ))}
          {/* 最終行: 工数合計（休憩・未入力を除いた分数）と、括弧内に基準合計工数を表示 */}
          <tr>
            <td>工数合計(基準時間)</td>
            <td>{totalMinutes}分({defaultTotal}分)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuDisplay;