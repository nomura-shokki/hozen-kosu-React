import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/InquirPage/InquirDetail.module.css";

// 型定義
interface Inquir {
  employee_no2: number;
  name: string;
  content_choice: string;
  inquiry: string;
  answer: string;
}

// メンバー情報の型定義 (一部省略)
interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

// APIからのレスポンスデータの型定義を更新
interface Response {
  inquir_data: Inquir; // 問い合わせデータ
  login_data: Member; // ログインユーザーデータ
  inquir_member_data: Member; // 質問者のメンバーデータ
  next_id: number | null; // 次の問い合わせID (Noneの場合はnullが返ると想定)
  before_id: number | null; // 前の問い合わせID (Noneの場合はnullが返ると想定)
}

// KosuEditコンポーネントの定義
const InquirDetail: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Inquir | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams<{ id: string }>();
  const currentId = params.id;
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [inquirMemberData, setInquirMemberData] = useState<Member | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);
  const [beforeId, setBeforeId] = useState<number | null>(null);

  const fetchData = useCallback(async (idToFetch: string | undefined = currentId) => {
    if (!idToFetch) {
      setError("問い合わせIDが指定されていません。");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // APIエンドポイントにGETリクエストを送信
      const response = await axios.get<Response>(
        `${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${idToFetch}/`,
        { withCredentials: true }
      );

      const { inquir_data, login_data, inquir_member_data, next_id, before_id } = response.data;

      setFormData(inquir_data);
      setMemberData(login_data);
      setInquirMemberData(inquir_member_data);
      setNextId(next_id);
      setBeforeId(before_id);
      
    } catch (err) {
      // エラーハンドリング（省略なし）
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(err.message);
        }
      } else {
        console.error("予期しないエラー:", err);
        setError("予期しないエラーが発生しました");
      }
    } finally {
      setLoading(false); // ローディング状態を解除
    }
  }, [currentId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNavigate = useCallback((id: number | null) => {
    if (id !== null) {
      navigate(`/inquir-detail/${id}`);
    }
  }, [navigate]);


  // ローディング中またはエラー、データがない場合の表示（省略なし）
  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  // レンダリング
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