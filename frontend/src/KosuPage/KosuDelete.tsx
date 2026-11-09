/**
 * ============================================================
 * ファイル名 : KosuDelete.tsx
 * 種別       : 画面コンポーネント（工数データ削除画面）
 * 概要       : 工数履歴一覧の「削除」リンクから開く確認画面。
 *              URLのIDで指定された工数データの内容を表示し、確認のうえ削除する。
 *
 * 主な機能   :
 *   - 削除対象の工数データ（就業日・整合性・直・勤務・残業時間）の表示
 *   - 作業内容の時間帯別一覧・グラフ・工数区分の凡例の表示
 *   - 確認ダイアログを出したうえで工数データを削除し、工数履歴一覧画面へ戻る
 *
 * 使用API    : GET    /api/kosu_update/<id>/  削除対象の工数データ取得（kosu/views/kosu_views.py の KosuUpdate）
 *              DELETE /api/kosu_delete/<id>/  工数データ削除（kosu/views/kosu_views.py の KosuDelete）
 * 画面URL    : /kosu-delete/:id               （index.tsx のルーティング定義。:id は工数データのID）
 * 関連ファイル: styles/KosuPage/KosuDelete.module.css, Components/Loading.tsx,
 *              Components/KosuDisplay.tsx, Components/KosuBarChart.tsx, Components/DefTable.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import KosuDisplay from "../Components/KosuDisplay"; // 作業内容を時間帯ごとに一覧表示する表
import KosuBarChart from "../Components/KosuBarChart"; // 作業内容を時刻ごとに色分けして表示するグラフ
import DefTable from "../Components/DefTable"; // 工数区分名と色の対応表（グラフの凡例）
import styles from "../styles/KosuPage/KosuDelete.module.css";

// ============================================================
// 型定義
// ============================================================

/** 削除対象の工数データ（GET /api/kosu_update/<id>/ のレスポンス kosu_data） */
interface Kosu {
  id: string; // 工数データのID（主キー）
  employee_no3: number; // 従業員番号
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"。tyokuMapping で表示名に変換する）
  time_work: string; // 作業内容（5分ごとの工数区分記号を288文字並べた文字列）
  detail_work: string; // 作業詳細（5分ごとの作業詳細を "$" 区切りで並べた文字列）
  over_time: number; // 残業時間（分）
  work_time: string; // 就業形態（出勤・休日出勤・年休 など）
  def_ver2: string; // この工数データの入力に使った工数区分定義Ver
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
  break_change: boolean; // 休憩変更チェック（工数入力時に休憩時間を自動で書き込まないようにしたか）
}

/** 工数区分定義（GET /api/kosu_update/<id>/ のレスポンス def_data）。キーは kosu_title_1 などの項目名 */
interface DefData {
  [key: string]: string | undefined; // 項目名 → 値（例: kosu_title_1 → 工数区分名）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数データ削除画面。
 *
 * 表示時にURLのIDで工数データを取得し、内容を表とグラフで表示する。
 * 「削除」ボタンを押すと確認ダイアログを出し、OKなら削除して工数履歴一覧画面へ戻る。
 *
 * @returns 工数データ削除画面のJSX
 */
const KosuDelete: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [defData, setDefData] = useState<DefData>({}); // 工数区分定義（工数区分記号を名称に変換するために使う）
  const navigate = useNavigate(); // 画面遷移用の関数
  const [record, setRecord] = useState<Kosu | null>(null); // 削除対象の工数データ（null なら未取得）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const { id } = useParams<{ id: string }>(); // URL（/kosu-delete/:id）に含まれる工数データのID
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null); // 作業内容（表・グラフ表示用）
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null); // 作業詳細（表表示用）
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null); // 直（表・グラフの表示時間帯の決定に使う）
  const [memberShop, setMemberShop] = useState<string>(""); // ログイン者のショップ（表・グラフの表示時間帯の決定に使う）
  // 工数データ表の要素を参照する（表の実際の幅を測るため）
  const tableRef = useRef<HTMLTableElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大の高さ（px）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の外枠の幅（px）

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLのIDが変わったとき: 削除対象の工数データを取得する
  useEffect(() => {
    /**
     * 削除対象の工数データ・工数区分定義・ログイン者のショップを取得し、state に保存する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（結果は record / defData などの state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/kosu_update/<id>/ : 工数編集画面と同じAPIで、工数データ・工数区分定義・人員データを取得
        const response = await api.get(`/api/kosu_update/${id}/`);
        const { kosu_data, member_data, def_data } = response.data;

        // 取得したデータを表示用の state にそれぞれ保存する
        setRecord(kosu_data);
        setDefData(def_data);
        setMemberShop(member_data.shop);
        setInitialTimeWork(kosu_data.time_work);
        setInitialWorkDetail(kosu_data.detail_work);
        setInitialTyoku(kosu_data.tyoku2);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 工数データなし など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // 工数データを取得したとき（表が表示されたとき）: 表の外枠の高さと幅を計算し、
  // 以後はウィンドウサイズが変わるたびに計算し直す
  useEffect(() => {
    /**
     * 表の外枠の最大の高さを「ウィンドウの高さ − 見出しの高さ − 余白40px」に更新する。
     *
     * @returns なし（結果は maxHeight の state に反映）
     */
    const updateMaxHeight = () => {
      // 画面内で最初の h1（画面タイトル）の高さ。見つからなければ0
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight - 40);
    };

    /**
     * 表の外枠の幅を「表の実際の幅 + 5px」に更新する（スクロールバー等で表が切れないよう少し広げる）。
     *
     * @returns なし（結果は tableWidth の state に反映）
     */
    const updateTableWidth = () => {
      // 表がまだ描画されていない（ref が空）場合は何もしない
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth + 5);
      }
    };

    // まず現在のサイズで1回計算する
    updateMaxHeight();
    updateTableWidth();

    // ウィンドウサイズ変更時にも計算し直すよう登録する
    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    // 画面を離れるとき・再実行の前に登録を解除する（解除しないと処理が重複して残る）
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [record]);

  // ---------- イベントハンドラ ----------

  /**
   * 「削除」ボタン押下時の処理。確認ダイアログでOKなら工数データを削除する。
   *
   * 削除に成功したら完了メッセージを出して工数履歴一覧画面へ戻る。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // 削除は取り消せないため、ブラウザの確認ダイアログで意思確認する（キャンセルなら何もしない）
    const confirmed = window.confirm("削除すると戻せません。削除しますか？");
    if (!confirmed) return;

    try {
      // DELETE /api/kosu_delete/<id>/ : 指定IDの工数データを削除（ログイン者本人のデータ以外は404）
      await api.delete(`/api/kosu_delete/${id}/`);
      alert("削除が完了しました");
      // 削除後は工数履歴一覧画面へ戻る
      navigate("/kosu-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404: 対象データなし・本人以外のデータ など）: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  // ---------- 定数（表示用の変換表） ----------

  // 直の番号 → 画面表示用の名称 の変換表
  const tyokuMapping: { [key: string]: string } = {
    "1": "1直",
    "2": "2直",
    "3": "3直",
    "4": "常昼",
    "5": "連1直",
    "6": "連2直",
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 工数データが取得できなかった場合はその旨だけを出す
  if (!record) return <div>データが見つかりません</div>;

  return (
    <>
      <div className={styles["kosu-delete-wrapper"]}>   
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数データ削除</h1>
        {/* 工数履歴一覧画面へ戻るリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-list">工数履歴</Link>
        </nav>
        {/* 確認メッセージ */}
        <p>以下の工数データを削除しますか？</p>

        {/* 削除ボタン（押すと確認ダイアログを出してから削除する） */}
        <button onClick={handleDelete} className="light_blue_button">
          削除
        </button>

        {/* 工数データの基本項目の表: 高さは maxHeight まで（超えたら縦スクロール）、幅は表の実寸に合わせる */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          <table ref={tableRef}>
            <tbody>
              {/* 就業日 */}
              <tr>
                <th className={styles["th-collar"]}>就業日</th>
                <td>{record.work_day2}</td>
              </tr>
              {/* 整合性: 工数入力OK/NG判定。OKなら青、NGなら赤で表示 */}
              <tr>
                <th className={styles["th-collar"]}>整合性</th>
                <td style={{ color: record.judgement ? "blue" : "red", marginLeft: "8px" }}>
                  {record.judgement ? "OK" : "NG"}
                </td>
              </tr>
              {/* 直: 番号を名称に変換して表示（変換できない値は空欄） */}
              <tr>
                <th className={styles["th-collar"]}>直</th>
                <td>{tyokuMapping[record.tyoku2] || ""}</td>
              </tr>
              {/* 勤務（就業形態） */}
              <tr>
                <th className={styles["th-collar"]}>勤務</th>
                <td>{record.work_time}</td>
              </tr>
              {/* 残業時間（分） */}
              <tr>
                <th className={styles["th-collar"]}>残業時間</th>
                <td>{record.over_time}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 作業内容の表示エリア: 時間帯別の一覧表・時刻ごとのグラフ・工数区分の凡例 */}
        {/* 直とショップを渡すのは、勤務時間帯に合わせて表示範囲を切り替えるため */}
        <div className={styles["centeredContainer"]}>
          <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""}  defData={defData} tyoku={initialTyoku || ""} shop={memberShop || ""} headerColor="#0ff" />
          <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
          <DefTable defData={defData} />
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default KosuDelete;