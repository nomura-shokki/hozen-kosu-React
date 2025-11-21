import React, { useState, useEffect } from "react";
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
}

// KosuEditコンポーネントの定義
const InquirDetail: React.FC = () => {
  const navigate = useNavigate(); // 画面遷移のためのフック
  const [formData, setFormData] = useState<Inquir | null>(null); // 編集対象
  const [loading, setLoading] = useState<boolean>(true); // ローディング状態
  const [error, setError] = useState<string | null>(null); // フェッチ時のエラーメッセージ
  const { id } = useParams<{ id: string }>(); // URLパラメータからデータのIDを取得
  const [memberData, setMemberData] = useState<Member | null>(null);

  // データ取得のためのuseEffect
  useEffect(() => {
    // APIエンドポイントにGETリクエストを送信し、工数データと関連データを取得
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${id}/`, { withCredentials: true })
      .then((response) => {
        const { inquir_data } = response.data;
        setFormData(inquir_data); // フォームデータをセット
        const login_data = response.data.login_data;
        setMemberData(login_data);
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
          <p>{formData ? formData.employee_no2 : ""}：{memberData ? memberData.name : ""}</p>
          <h2>内容:</h2>
          <p>{formData ? formData.content_choice : ""}</p>
          <h2>問い合わせ:</h2>
          <p>{formData ? formData.inquiry : ""}</p>
          <h2>回答:</h2>
          <p>{formData ? formData.answer : ""}</p>
        </div>
        <Link to={`/inquir-edit/${id}`} className={styles["pink_button"]}>編集</Link>
      </div>
    </>
  );
};

export default InquirDetail;