import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import KosuBarChart from "../components/KosuBarChart"; // 工数データを視覚化するカスタムコンポーネント
import KosuDisplay from "../components/KosuDisplay";
import DefTable from "../components/DefTable"; // 定義データを表示するカスタムコンポーネント
import Loading from "../components/Loading"; // ローディング画面を表示するカスタムコンポーネント
import styles from "../styles/TeamPage/TeamDetail.module.css";

// 工数データの型定義
interface Kosu {
  employee_no3: number; // 従業員番号
  name: string;
  work_day2: string; // 就業日 (YYYY-MM-DD形式の文字列)
  tyoku2: string; // 直 (勤務シフト)
  time_work: string; // 作業時間データ (文字列、おそらくエンコードされた形式)
  detail_work: string; // 作業詳細データ
  over_time: number; // 残業時間 (分単位)
  work_time: string; // 勤務形態
  def_ver2: string; // 定義バージョン
  judgement: boolean; // 判定結果 (OK/NG)
  break_change: boolean; // 休憩変更フラグ
}

// 定義データの型定義
interface DefData {
  [key: string]: string | undefined;
}

// メンバー情報の型定義
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // 所属部署/職場
}

// APIからのレスポンスデータの型定義
interface KosuResponse {
  kosu_data: Kosu; // 工数データ本体
  def_data: DefData; // 定義データ
  member_data: Member; // メンバー情報
}

// KosuEditコンポーネントの定義
const InquirDetail: React.FC = () => {
  const navigate = useNavigate(); // 画面遷移のためのフック
  const [formData, setFormData] = useState<Kosu | null>(null); // 編集対象の工数データ
  const [loading, setLoading] = useState<boolean>(true); // ローディング状態
  const [error, setError] = useState<string | null>(null); // フェッチ時のエラーメッセージ
  const { id } = useParams<{ id: string }>(); // URLパラメータから工数データのIDを取得
  const [defData, setDefData] = useState<DefData>({}); // 定義データ (作業内容の名称など)
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null); // 初期表示用のtime_work (チャート用)
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null); // 初期表示用のtyoku2 (チャート用)
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null); // 初期の作業詳細

  // データ取得のためのuseEffect
  useEffect(() => {
    // APIエンドポイントにGETリクエストを送信し、工数データと関連データを取得
    axios
      .get<KosuResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/team_detail/${id}/`, { withCredentials: true })
      .then((response) => {
        const { kosu_data } = response.data;
        setFormData(kosu_data); // フォームデータをセット
        const def_data = response.data.def_data || {};
        setDefData(def_data); // 定義データをセット
        const member_data = response.data.member_data;
        setMemberData(member_data);
        setInitialTimeWork(kosu_data.time_work); // 初期表示用のtime_workをセット
        setInitialWorkDetail(kosu_data.detail_work);
        setInitialTyoku(kosu_data.tyoku2); // 初期表示用のtyoku2をセット
        setLoading(false); // ローディング終了
      })
      .catch((err) => {
        console.error("APIエラー:", err);
        // 認証エラー (401) の場合はログイン画面へ遷移
        if (err.response?.status === 401) {
          navigate("/login");
        } else {
          setError(err.message); // その他のエラーをセット
        }
        setLoading(false); // ローディング終了
      });
  }, [id, navigate]); // 依存配列: idとnavigateが変更されたときのみ実行

  // ローディング中またはエラー、データがない場合の表示
  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const tyokuMapping: { [key: string]: string } = {
    "1": "1直",
    "2": "2直",
    "3": "3直",
    "4": "常昼",
    "5": "連1直",
    "6": "連2直",
  };

  const tyokuDisplayName = tyokuMapping[formData.tyoku2] || formData.tyoku2;

  const formatWorkDay = (dateString: string): string => {
    // YYYY-MM-DD 形式から Date オブジェクトを作成
    const date = new Date(dateString);
  
    // Date が無効な場合は元の文字列を返す
    if (isNaN(date.getTime())) {
      return dateString;
    }
  
    // 曜日を取得するための配列
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
  
    // "2025年10月6日(月)" の形式で文字列を構築
    return `${year}年${month}月${day}日(${dayOfWeek})`;
  };
  
  const displayDate = formatWorkDay(formData.work_day2);

  // レンダリング
  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["team-detail-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数履歴詳細</h1>
        <nav className={styles["team-nav"]}>
          <Link to="/team-list">班員工数履歴</Link>
          <Link to="/team-calendar">班員工数入力状況</Link>
        </nav>
        <div className={styles["kosu_detail"]}>
          <h2 className={styles["h1-collar"]}>{displayDate}</h2>
          {memberData?.name && ( 
            <h2>氏名: {memberData.name}</h2>
          )}
          {formData.work_time && (
            <h2>勤務: {formData.work_time}</h2>
          )}
          {formData.tyoku2 && (
            <h2>直: {tyokuDisplayName}</h2>
          )}
          {formData.over_time !== null && formData.over_time !== undefined && (
            <h2>残業時間: {(formData.over_time / 60).toFixed(2)}H</h2>
          )}
        </div>
        <div className={styles["centeredContainer"]}>
          <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""} defData={defData} tyoku={initialTyoku || ""} shop={memberData?.shop || ""} headerColor="#f50" />
          <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberData?.shop || ""} />
          <DefTable defData={defData} />
        </div>
      </div>
    </>
  );
};

export default InquirDetail;