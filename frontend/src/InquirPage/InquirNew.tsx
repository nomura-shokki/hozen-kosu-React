import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios"; // HTTPクライアント
import { Link, useNavigate } from "react-router-dom"; // 画面遷移に使用
import ItemSelect from "../components/ItemSelect";
import styles from "../styles/InquirPage/InquirNew.module.css"; // CSSモジュール

// フォームで取り扱うデータ型を定義
interface FormData {
  content_choice: string;
  inquiry: string;
}

const InquirNew: React.FC = () => {
  // 初期フォーム値と状態管理
  const [formData, setFormData] = useState<FormData>({
    content_choice: "",
    inquiry: "",
  });

  // エラーメッセージ表示用の状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // NOTE: searchItemInput は formData.content_choice で代用できるため削除も可能ですが、
  // 変更しないという指示のため、ItemSelectのonChangeでformDataを更新するように修正します。
  const [searchItemInput, setSearchItemInput] = useState<string>(""); 

  // ページ遷移用のフック
  const navigate = useNavigate();

  // 初回マウント時、ログインチェック（セッション確認）
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_new/`, { withCredentials: true })
      .catch((err) => {
        // 未認証や権限不足の場合のリダイレクト処理
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          console.error("不明なエラー:", err);
        }
      });
  }, [navigate]);

  // フォーム入力値の変更ハンドラー
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    // name属性に基づいてformDataを更新
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };
  
  // ItemSelect（内容）の変更ハンドラー
  const handleContentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormData((prevData) => ({
      ...prevData,
      content_choice: value, // content_choiceを更新
    }));
    setSearchItemInput(value); // 既存のsearchItemInputも更新（念のため）
  };

  // フォーム送信時の処理
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null); // エラーリセット

    // content_choice（内容）と inquiry（作業詳細）を含む formData を送信
    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_new/`, formData, { withCredentials: true })
      .then(() => {
        alert("登録完了！");

        // フォームをリセット
        setFormData({
          content_choice: "",
          inquiry: "",
        });
        setSearchItemInput(""); // ItemSelect の表示もリセット
      })
      .catch((error) => {
        console.error(error);
        // サーバーが返すエラーメッセージを表示
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error || "登録中にエラーが発生しました。");
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  return (
    <div className={styles["inquir-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>問い合わせ</h1>
      <nav className={styles["inquir-nav"]}>
        <Link to="/inquir-menu">問い合わせMENU</Link>
      </nav>

      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

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
          <label htmlFor="inquiry">作業詳細：</label>
          <textarea
            id="inquiry"
            name="inquiry"
            value={formData.inquiry}
            onChange={handleChange}
            rows={5}
          />
          <button type="submit" className="pink_button">登録</button>
        </div>
      </form>
    </div>
  );
};

export default InquirNew;