import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/InquirPage/InquirDetail.module.css";

interface Inquir {
  employee_no2: number;
  name: string;
  content_choice: string;
  inquiry: string;
  answer: string;
}

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

interface Response {
  inquir_data: Inquir;
  login_data: Member;
  inquir_member_data: Member;
  next_id: number | null;
  before_id: number | null;
}

const InquirDetail: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Inquir | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams<{ id: string }>();
  const { id } = useParams<{ id: string }>();
  const currentId = params.id;
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [inquirMemberData, setInquirMemberData] = useState<Member | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);
  const [beforeId, setBeforeId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${id}/`, { withCredentials: true });
        const { inquir_data, login_data, inquir_member_data, next_id, before_id } = response.data;
        setFormData(inquir_data);
        setMemberData(login_data);
        setInquirMemberData(inquir_member_data);
        setNextId(next_id);
        setBeforeId(before_id);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleNavigate = useCallback((id: number | null) => {
    if (id !== null) navigate(`/inquir-detail/${id}`);
  }, [navigate]);

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["inquir-detail-wrapper"]}>
        <h1 className={styles["h1-collar"]}>問い合わせ詳細</h1>
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-list">問い合わせ履歴</Link>
        </nav>

        <div className={styles["pagination-buttons"]}>
          {beforeId !== null && (
            <button 
              onClick={() => handleNavigate(beforeId)} 
              className="pink_button"
            >
              ◀ 前へ
            </button>
          )}

          {nextId !== null && (
            <button 
              onClick={() => handleNavigate(nextId)} 
              className="pink_button"
            >
              次へ ▶
            </button>
          )}
        </div>

        <div className={styles["inquir-content"]}>
          <h2>問い合わせ者:</h2>
          <p>{formData.employee_no2}：{inquirMemberData?.name}</p>
          <h2>内容:</h2>
          <p>{formData.content_choice}</p>
          <h2>問い合わせ:</h2>
          <p>{formData.inquiry}</p>
          <h2>回答:</h2>
          <p>{formData.answer}</p>
          {(memberData?.administrator || formData.employee_no2 === memberData?.employee_no) && (
            <Link to={`/inquir-update/${currentId}`} className="pink_button">編集</Link>
          )}
        </div>
      </div>
    </>
  );
};

export default InquirDetail;