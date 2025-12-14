import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import ItemSelect from "../components/ItemSelect";
import styles from "../styles/InquirPage/InquirUpdate.module.css";

// 型定義
interface Inquir {
  employee_no2: number;
  name: string; // <--- 変換後の名前を保持するために必要
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
}

// APIからのレスポンスデータの型定義を更新
interface Response {
  inquir_data: Inquir; // 問い合わせデータ本体
  login_data: Member; // ログインユーザーのメンバー情報
  inquir_member_data: Member; // 質問者のメンバー情報
}

// KosuEditコンポーネントの定義
const InquirUpdate: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Inquir | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const [memberData, setMemberData] = useState<Member | null>(null);

  useEffect(() => {
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const { inquir_data, login_data } = response.data;
        setFormData(inquir_data);
        setMemberData(login_data);
        setLoading(false);
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

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    // name属性に基づいてformDataを更新
    setFormData((prevData) => {
      // prevDataがnullの場合は更新をスキップまたは初期値で返す
      if (!prevData) return null;
      return {
        ...prevData,
        [name]: value,
      } as Inquir;
    });
  };

  const handleContentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormData((prevData) => {
      // prevDataがnullの場合は更新をスキップまたは初期値で返す
      if (!prevData) return null;
      return {
        ...prevData,
        content_choice: value, // content_choiceを更新
      } as Inquir; // 明示的にInquir型としてアサーション
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // formDataがnullでないことを確認
    if (!formData) {
      setError("フォームデータがありません。");
      return;
    }

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_update/${id}/`, formData, { withCredentials: true })
      .then(() => {
        alert("登録完了！");
        navigate("/inquir-list"); 
      })
      .catch((error) => {
        console.error(error);
        if (error.response && error.response.data && typeof error.response.data === 'string') {
          // 500エラーでHTMLが返された場合など
          alert("編集時に不明なサーバーエラーが発生しました。IT担当者に連絡してください。");
        } else if (error.response && error.response.data) {
          const errorMessage = error.response.data.detail || error.response.data.error || "削除時にエラーが発生しました。";
          alert(errorMessage);
        } else {
          alert("ネットワークエラーまたは不明なエラーが発生しました。");
        }
      });
  };

  const handleDelete = () => {
    const confirmed = window.confirm("削除すると戻せません。削除しますか？");
    if (!confirmed) {
      return;
    }

    axios
      .delete(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_update/${id}/`, { withCredentials: true })
      .then(() => {
        alert("削除が完了しました");
        navigate("/inquir-list");
      })
      .catch((error) => {
        console.error(error);
        alert("削除時にエラーが発生しました");
      });
  };

  // ローディング中またはエラー、データがない場合の表示
  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!formData) {
    // データの取得が完了したが、なぜかformDataがnullの場合
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

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            <label htmlFor="ItemSelect">内容選択:</label>
            <ItemSelect
              id="ItemSelect"
              name="content_choice"
              value={formData.content_choice}
              onChange={handleContentChange}
            />
            <label htmlFor="inquiry">問い合わせ：</label>
            <textarea
              id="inquiry"
              name="inquiry"
              value={formData.inquiry}
              onChange={handleChange}
              rows={5}
            />
            {memberData?.administrator && (
              <>
                <label htmlFor="answer">回答：</label>
                <textarea
                  id="answer"
                  name="answer"
                  value={formData.answer}
                  onChange={handleChange}
                  rows={5}
                />
              </>
            )}
            <div className={styles["pagination-buttons"]}>
              <button type="submit" className="pink_button">編集</button>
              <button type="button" onClick={handleDelete} className="pink_button">削除</button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default InquirUpdate;