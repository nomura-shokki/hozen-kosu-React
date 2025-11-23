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

// メンバー情報の型定義
interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
  break_time1: string;
  break_time1_over1: string;
  break_time1_over2: string;
  break_time1_over3: string;
  break_time2: string;
  break_time2_over1: string;
  break_time2_over2: string;
  break_time2_over3: string;
  break_time3: string;
  break_time3_over1: string;
  break_time3_over2: string;
  break_time3_over3: string;
  break_time4: string;
  break_time4_over1: string;
  break_time4_over2: string;
  break_time4_over3: string;
  break_time5: string;
  break_time5_over1: string;
  break_time5_over2: string;
  break_time5_over3: string;
  break_time6: string;
  break_time6_over1: string;
  break_time6_over2: string;
  break_time6_over3: string;
  break_check: boolean;
  def_prediction: boolean;
}

// APIからのレスポンスデータの型定義
interface Response {
  inquir_data: Inquir; // 工数データ本体
  login_data: Member; // メンバー情報
  inquir_member_data: Member; // 質問者のメンバー情報
  member_data: Member;
}

// KosuEditコンポーネントの定義
const InquirDetail: React.FC = () => {
  const navigate = useNavigate(); // 画面遷移のためのフック
  const [data, setData] = useState<Inquir[]>([]);
  const [formData, setFormData] = useState<Inquir | null>(null); // 編集対象
  const [loading, setLoading] = useState<boolean>(true); // ローディング状態
  const [error, setError] = useState<string | null>(null); // フェッチ時のエラーメッセージ
  const { id } = useParams<{ id: string }>(); // URLパラメータからデータのIDを取得
  const [memberData, setMemberData] = useState<Member | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // APIエンドポイントにGETリクエストを送信
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${id}/`, {withCredentials: true,});
      const paginationData = response.data?.inquir_data || {};
      const results = paginationData.results || [];
      const memberOptions = response.data?.member_data || [];

      // 1. メンバーIDを名前に変換するためのマップを作成
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: Member) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 2. 取得したデータ（results）のnameを従業員番号から名前に変換
      const transformedData = results.map((item: Inquir) => ({
        ...item,
        // item.employee_no3をキーとしてmemberNameMapから名前を取得
        name: memberNameMap[item.employee_no2] || `Unknown (${item.employee_no2})`,
      }));

      const { inquir_data } = response.data;
      setFormData(inquir_data); // フォームデータをセット
      const login_data = response.data.login_data;
      setMemberData(login_data);
      setLoading(false); // ローディング終了
    } catch (err) {
      // エラーハンドリング
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          // 認証エラー（トークン切れなど）の場合はログインページへ遷移
          navigate("/login");
        } else if (err.response?.status === 403) {
          // 権限エラーの場合はトップページへ遷移
          navigate("/");
        } else {
          // その他のAPIエラー
          setError(err.message);
        }
      } else {
        // Axios以外の予期せぬエラー
        console.error("予期しないエラー:", err);
        setError("予期しないエラーが発生しました");
      }
    } finally {
      // ローディング状態を解除
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // レンダリング
  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["inquir-detail-wrapper"]}>
        <h1 className={styles["h1-collar"]}>問い合わせ詳細</h1>
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-list">問い合わせ履歴</Link>
        </nav>

        <div className={styles["inquir-content"]}>
          <h2>問い合わせ者:</h2> 
          <p>{formData ? formData.employee_no2 : ""}：{formData ? formData.name : ""}</p>
          <h2>内容:</h2>
          <p>{formData ? formData.content_choice : ""}</p>
          <h2>問い合わせ:</h2>
          <p>{formData ? formData.inquiry : ""}</p>
          <h2>回答:</h2>
          <p>{formData ? formData.answer : ""}</p>
          {memberData?.administrator && (
            <Link to={`/inquir-edit/${id}`} className="pink_button">編集</Link>
          )}
        </div>
      </div>
    </>
  );
};

export default InquirDetail;