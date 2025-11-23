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
  // ★★★ 追加: 次/前のIDを含める ★★★
  next_id: number | null; // 次の問い合わせID (Noneの場合はnullが返ると想定)
  before_id: number | null; // 前の問い合わせID (Noneの場合はnullが返ると想定)
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
  
  // ★★★ 追加: 次/前のIDを保持するState ★★★
  const [nextId, setNextId] = useState<number | null>(null);
  const [beforeId, setBeforeId] = useState<number | null>(null);

  // IDが変わったときに再実行されるように、currentIdを依存配列に追加
  const fetchData = useCallback(async (idToFetch: string | undefined = currentId) => {
    if (!idToFetch) {
        setError("問い合わせIDが指定されていません。");
        setLoading(false);
        return;
    }
    
    setLoading(true);
    try {
      // APIエンドポイントにGETリクエストを送信
      const response = await axios.get<Response>( // <--- Response型を指定
        `${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${idToFetch}/`, // ★★★ idToFetch を使用 ★★★
        { withCredentials: true }
      );
      
      // ★★★ 取得するデータに next_id, before_id を追加 ★★★
      const { inquir_data, login_data, member_data, next_id, before_id } = response.data;

      // 1. メンバーIDを名前に変換するためのマップを作成
      const memberNameMap: { [key: number]: string } = {};
      member_data.forEach((member: Member) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 2. 取得した問い合わせデータ (inquir_data) の name を従業員番号から名前に変換
      const transformedInquirData: Inquir = {
        ...inquir_data,
        // inquir_data.employee_no2 をキーとしてmemberNameMapから名前を取得
        name: memberNameMap[inquir_data.employee_no2] || `Unknown (${inquir_data.employee_no2})`,
      };

      setFormData(transformedInquirData); // フォームデータをセット（変換後の名前付き）
      setMemberData(login_data); // ログインユーザー情報をセット
      
      // ★★★ 次/前のIDをStateにセット ★★★
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
  }, [currentId, navigate]); // currentIdを依存配列に追加

  useEffect(() => {
    fetchData(); // currentIdが変更されたら自動的に再実行
  }, [fetchData]);

  // ★★★ "次へ" / "前へ" のハンドラ関数を追加 ★★★
  const handleNavigate = useCallback((id: number | null) => {
    if (id !== null) {
      // URLを更新し、コンポーネントを再レンダリングさせる (useParamsのidが更新される)
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

        <div className={styles["inquir-content"]}>
          <h2>問い合わせ者:</h2>
          <p>{formData.employee_no2}：{formData.name}</p>
          <h2>内容:</h2>
          <p>{formData.content_choice}</p>
          <h2>問い合わせ:</h2>
          <p>{formData.inquiry}</p>
          <h2>回答:</h2>
          <p>{formData.answer}</p>
          {(memberData?.administrator || formData.employee_no2 === memberData?.employee_no) && (
            <Link to={`/inquir-edit/${currentId}`} className="pink_button">編集</Link>
          )}
        </div>

        <div className={styles["pagination-buttons"]}>
          {beforeId !== null && (
            <button 
              onClick={() => handleNavigate(beforeId)} 
              className="gray_button"
            >
              前へ
            </button>
          )}

          {nextId !== null && (
            <button 
              onClick={() => handleNavigate(nextId)} 
              className="pink_button"
            >
              次へ
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default InquirDetail;