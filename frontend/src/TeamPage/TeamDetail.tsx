import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import KosuBarChart from "../Components/KosuBarChart";
import KosuDisplay from "../Components/KosuDisplay";
import DefTable from "../Components/DefTable";
import Loading from "../Components/Loading";
import styles from "../styles/TeamPage/TeamDetail.module.css";

interface Kosu {
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  time_work: string;
  detail_work: string;
  over_time: number;
  work_time: string;
  def_ver2: string; 
  judgement: boolean;
  break_change: boolean;
}

interface DefData {
  [key: string]: string | undefined;
}

interface Member {
  employee_no: number;
  name: string;
  shop: string;
}

interface KosuResponse {
  kosu_data: Kosu;
  def_data: DefData;
  member_data: Member;
}

const TeamDetail: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Kosu | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const [defData, setDefData] = useState<DefData>({});
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null);
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null);
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamDetail = async () => {
      try {
        const response = await axios.get<KosuResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/team_detail/${id}/`,{ withCredentials: true });
        const { kosu_data, def_data, member_data } = response.data;
        setFormData(kosu_data);
        setDefData(def_data || {});
        setMemberData(member_data);
        setInitialTimeWork(kosu_data.time_work);
        setInitialWorkDetail(kosu_data.detail_work);
        setInitialTyoku(kosu_data.tyoku2);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchTeamDetail();
  }, [id, navigate]);

  const tyokuMapping: { [key: string]: string } = {
    "1": "1直",
    "2": "2直",
    "3": "3直",
    "4": "常昼",
    "5": "連1直",
    "6": "連2直",
  };

  const formatWorkDay = (dateString: string): string => {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return dateString;
    }

    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];

    return `${year}年${month}月${day}日(${dayOfWeek})`;
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;
  if (!formData) return <div>データが見つかりません</div>;

  const tyokuDisplayName = tyokuMapping[formData.tyoku2] || formData.tyoku2;
  const displayDate = formatWorkDay(formData.work_day2);

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

export default TeamDetail;