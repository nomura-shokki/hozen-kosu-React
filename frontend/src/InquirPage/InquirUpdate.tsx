import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/InquirPage/InquirDetail.module.css";

// 型定義
interface Inquir {
  employee_no2: number;
  name: string; // <--- 変換後の名前を保持するために必要
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
  // ... その他のブレイクタイム関連のプロパティ
}

// APIからのレスポンスデータの型定義を更新
interface Response {
  inquir_data: Inquir; // 問い合わせデータ本体
  login_data: Member; // ログインユーザーのメンバー情報
  inquir_member_data: Member; // 質問者のメンバー情報 (今回は使用しないが、APIレスポンスに含まれる可能性)
  member_data: Member[]; // <--- メンバー一覧データが配列であることを想定
}

// KosuEditコンポーネントの定義
const InquirDetail: React.FC = () => {
  const navigate = useNavigate();
  // 問い合わせデータは単一のオブジェクトなので、useState<Inquir | null>で十分
  // const [data, setData] = useState<Inquir[]>([]); <--- この行は不要です
  const [formData, setFormData] = useState<Inquir | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // URLパラメータのIDは string | undefined なので、型を再定義
  const params = useParams<{ id: string }>();
  const currentId = params.id; // 現在のIDを明確にする
  const [memberData, setMemberData] = useState<Member | null>(null);

  // IDが変わったときに再実行されるように、currentIdを依存配列に追加
  const fetchData = useCallback(async (idToFetch: string | undefined = currentId) => {    
    setLoading(true);
    try {
      // APIエンドポイントにGETリクエストを送信
      const response = await axios.get<Response>( // <--- Response型を指定
        `${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${idToFetch}/`, // ★★★ idToFetch を使用 ★★★
        { withCredentials: true }
      );
      
      // ★★★ 取得するデータに next_id, before_id を追加 ★★★
      const { inquir_data, login_data, inquir_member_data } = response.data;

      setFormData(inquir_data); // フォームデータをセット（変換後の名前付き）
      setMemberData(login_data); // ログインユーザー情報をセット
      
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
  }, [currentId, navigate]); // currentIdを依存配列に追加

  useEffect(() => {
    fetchData(); // currentIdが変更されたら自動的に再実行
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
      <div className={styles["inquir-update-wrapper"]}>
        <h1 className={styles["h1-collar"]}>問い合わせ編集</h1>
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-list">問い合わせ履歴</Link>
        </nav>

        <div className={styles["inquir-content"]}>
          <h2>内容:</h2>
          <p>{formData.content_choice}</p>
          <h2>問い合わせ:</h2>
          <p>{formData.inquiry}</p>
          <h2>回答:</h2>
          <p>{formData.answer}</p>

        </div>
      </div>
    </>
  );
};

export default InquirDetail;