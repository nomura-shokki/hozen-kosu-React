/**
 * ============================================================
 * ファイル名 : TeamDetail.tsx
 * 種別       : 画面コンポーネント（班員工数履歴詳細画面）
 * 概要       : 班員の工数データ1件（1日1人分）の内容を表示する閲覧専用の画面。
 *              班員工数履歴・班員工数入力状況の各画面から、工数データのIDをURLに付けて遷移してくる。
 *
 * 主な機能   :
 *   - 就業日・氏名・就業形態・直・残業時間の表示
 *   - 作業内容を時間帯ごとの表（KosuDisplay）と色分けグラフ（KosuBarChart）で表示
 *   - 工数区分名と色の対応表（DefTable）の表示
 *     （工数データに記録された工数区分定義Ver、なければ現在選択中の工数区分定義Verを使う）
 *
 * 使用API    : GET /api/team_detail/<id>/  班員の工数データ詳細取得（kosu/views/team_views.py の TeamDetail）
 * 画面URL    : /team-detail/:id             （index.tsx のルーティング定義。:id は工数データのID）
 * 関連ファイル: styles/TeamPage/TeamDetail.module.css,
 *              Components/KosuDisplay.tsx, Components/KosuBarChart.tsx, Components/DefTable.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import KosuBarChart from "../Components/KosuBarChart"; // 作業内容を工数区分ごとに色分けした棒グラフ
import KosuDisplay from "../Components/KosuDisplay"; // 作業内容を「作業時間・作業内容・作業詳細」の表で表示する部品
import DefTable from "../Components/DefTable"; // 工数区分名とグラフの色の対応表（凡例）
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/TeamPage/TeamDetail.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数データ1件分（GET /api/team_detail/<id>/ のレスポンス kosu_data。一部の項目のみ定義） */
interface Kosu {
  employee_no3: number; // 従業員番号
  name: string; // 氏名（サーバーからは人員データのIDが届く。この画面では使用していない）
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"）
  time_work: string; // 作業内容（5分ごとの工数区分記号を288文字並べた文字列。"#"=作業なし、"$"=休憩）
  detail_work: string; // 作業詳細（5分ごとの作業詳細を "$" 区切りで並べた文字列）
  over_time: number; // 残業時間（分。表示時に60で割って時間に換算する）
  work_time: string; // 就業形態（出勤・休日出勤・年休 など）
  def_ver2: string; // この工数データの入力時に使われた工数区分定義Ver名
  judgement: boolean; // 工数入力OK/NG判定（この画面では使用していない）
  break_change: boolean; // 休憩変更チェック（この画面では使用していない）
}

/** 工数区分定義データ（kosu_title_1 などの項目名 → 値。項目が多いため任意のキーを許す形で定義） */
interface DefData {
  [key: string]: string | undefined;
}

/** 工数データの持ち主（班員）の人員データ（一部の項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（直とあわせて表・グラフの表示時間帯の決定に使う）
}

/** GET /api/team_detail/<id>/ のレスポンス全体 */
interface KosuResponse {
  kosu_data: Kosu; // 工数データ
  def_data: DefData; // 工数区分定義データ
  member_data: Member; // 班員の人員データ
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 班員工数履歴詳細画面。
 *
 * URLの :id から工数データを取得し、内容を表・グラフ・凡例で表示する（編集はできない）。
 *
 * @returns 班員工数履歴詳細画面のJSX
 */
const TeamDetail: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<Kosu | null>(null); // 表示する工数データ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const { id } = useParams<{ id: string }>(); // URL（/team-detail/:id）から取り出した工数データのID
  const [defData, setDefData] = useState<DefData>({}); // 工数区分定義データ（表・凡例で工数区分名を表示するのに使う）
  const [memberData, setMemberData] = useState<Member | null>(null); // 班員の人員データ
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null); // 表・グラフに渡す作業内容
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null); // 表・グラフに渡す直
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null); // 表に渡す作業詳細

  // ---------- 副作用（useEffect） ----------

  // 初回表示時と、URLの id が変わったとき: その工数データの詳細を取得する
  useEffect(() => {
    /**
     * 工数データの詳細をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・工数区分定義Ver未選択・人員や工数区分定義が見つからない）ならログイン画面へ、
     * 403（権限なし）ならメインメニューへ遷移する。404（工数データなし）などはメッセージを表示する。
     *
     * @returns なし（結果は formData / defData / memberData / initial〇〇 / error の state に反映）
     */
    const fetchTeamDetail = async () => {
      try {
        // GET /api/team_detail/<id>/ : 工数データ・工数区分定義データ・班員の人員データを取得
        const response = await api.get<KosuResponse>(`/api/team_detail/${id}/`);
        const { kosu_data, def_data, member_data } = response.data;
        setFormData(kosu_data);
        // 工数区分定義データが空の場合でも表・凡例が動くよう空オブジェクトにする
        setDefData(def_data || {});
        setMemberData(member_data);
        // 表・グラフの部品に渡す作業内容・作業詳細・直を保存する
        setInitialTimeWork(kosu_data.time_work);
        setInitialWorkDetail(kosu_data.detail_work);
        setInitialTyoku(kosu_data.tyoku2);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Ver未選択・人員や工数区分定義が見つからない → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 工数データなし / 400: データ重複 など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchTeamDetail();
  }, [id, navigate]);

  // ---------- 表示用の変換 ----------

  // 直の番号 → 画面表示用の名称 の対応表
  const tyokuMapping: { [key: string]: string } = {
    "1": "1直",
    "2": "2直",
    "3": "3直",
    "4": "常昼",
    "5": "連1直",
    "6": "連2直",
  };

  /**
   * 就業日を「YYYY年M月D日(曜)」形式の文字列に変換する。
   *
   * @param dateString - 就業日（"YYYY-MM-DD"）
   * @returns 表示用の日付（例: "2026-11-09" → "2026年11月9日(月)"）。日付として解釈できない場合は元の文字列
   */
  const formatWorkDay = (dateString: string): string => {
    const date = new Date(dateString);

    // 不正な日付（getTime() が NaN）の場合は変換せずにそのまま返す
    if (isNaN(date.getTime())) {
      return dateString;
    }

    // Date.getDay() の戻り値（0=日曜〜6=土曜）の順に並べた曜日表
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const year = date.getFullYear();
    // getMonth() は0始まり（1月=0）のため +1 する
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];

    return `${year}年${month}月${day}日(${dayOfWeek})`;
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 取得できたデータがない場合（401/403 で遷移する直前など）はメッセージだけを出す
  if (!formData) return <div>データが見つかりません</div>;

  // 直の表示名（対応表にない値はそのまま表示）と、表示用の就業日
  const tyokuDisplayName = tyokuMapping[formData.tyoku2] || formData.tyoku2;
  const displayDate = formatWorkDay(formData.work_day2);

  return (
    <>
      {/* ローディング表示（この位置では loading は常に false のため、フェードアウトして消える） */}
      <Loading isLoading={loading} />
      <div className={styles["team-detail-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数履歴詳細</h1>
        {/* 遷移元の画面（班員工数履歴・班員工数入力状況）へ戻るリンク */}
        <nav className={styles["team-nav"]}>
          <Link to="/team-list">班員工数履歴</Link>
          <Link to="/team-calendar">班員工数入力状況</Link>
        </nav>
        {/* 工数データの基本情報（値がある項目だけ表示） */}
        <div className={styles["kosu_detail"]}>
          {/* 就業日（例: 2026年11月9日(月)） */}
          <h2 className={styles["h1-collar"]}>{displayDate}</h2>
          {/* 班員の氏名 */}
          {memberData?.name && ( 
            <h2>氏名: {memberData.name}</h2>
          )}
          {/* 就業形態 */}
          {formData.work_time && (
            <h2>勤務: {formData.work_time}</h2>
          )}
          {/* 直の名称 */}
          {formData.tyoku2 && (
            <h2>直: {tyokuDisplayName}</h2>
          )}
          {/* 残業時間: 分を時間に換算して小数2桁で表示（例: 90 → 1.50H）。0 でも表示する */}
          {formData.over_time !== null && formData.over_time !== undefined && (
            <h2>残業時間: {(formData.over_time / 60).toFixed(2)}H</h2>
          )}
        </div>
        {/* 作業内容の表示エリア */}
        <div className={styles["centeredContainer"]}>
          {/* 時間帯ごとの作業内容・作業詳細の表（直・ショップから表示する時間帯を決める。見出し色はオレンジ） */}
          <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""} defData={defData} tyoku={initialTyoku || ""} shop={memberData?.shop || ""} work={formData?.work_time || ""} headerColor="#f50" />
          {/* 作業内容を工数区分ごとに色分けした棒グラフ */}
          <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberData?.shop || ""} />
          {/* 工数区分名とグラフの色の対応表 */}
          <DefTable defData={defData} />
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default TeamDetail;