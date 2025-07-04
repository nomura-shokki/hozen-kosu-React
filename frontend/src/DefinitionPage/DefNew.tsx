import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // 画面遷移に使用
import styles from "../styles/DefinitionPage/DefNew.module.css";

// 工数区分名と定義を動的に管理
interface KosuDefinition {
  title: string;
  division1: string;
  division2: string;
}

interface FormData {
  kosu_name: string;
  kosu_definitions: KosuDefinition[];
}

const DefNew: React.FC = () => {
  // 初期フォーム値と状態管理
  const [formData, setFormData] = useState<FormData>({
    kosu_name: "",
    kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }), // 50個の工数区分と定義を初期化
  });

  // エラーメッセージ表示用の状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ページ遷移用のフック
  const navigate = useNavigate();

  // 初回マウント時、ログインチェック（セッション確認）
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, { withCredentials: true })
      .catch((err) => {
        // 未認証や権限不足の場合のリダイレクト処理
        if (err.response?.status === 401) {
          navigate('/login');
        } else if (err.response?.status === 403) {
          navigate('/');
        } else {
          console.error('不明なエラー:', err);
        }
      });
  }, [navigate]);

  // 入力項目が変更されたときの処理
  const handleChange = (event: ChangeEvent<HTMLInputElement>, index?: number, field?: string) => {
    const { name, value } = event.target;

    if (index !== undefined && field) {
      // 特定の工数区分定義を更新
      const updatedDefinitions = [...formData.kosu_definitions];
      updatedDefinitions[index] = { ...updatedDefinitions[index], [field]: value };

      setFormData((prev) => ({
        ...prev,
        kosu_definitions: updatedDefinitions,
      }));
    } else {
      // 工数区分定義Ver名を更新
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // フォーム送信時の処理
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null); // エラーリセット

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, formData, { withCredentials: true })
      .then(() => {
        alert('登録完了！');

        // フォームをリセット
        setFormData({
          kosu_name: "",
          kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }),
        });
      })
      .catch((error) => {
        console.error(error);
        // サーバーが返すエラーメッセージを表示
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage('不明なエラーが発生しました。IT担当者に連絡してください。');
        }
      });
  };

  return (
    <div className={styles["member-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数区分定義登録</h1>
      <nav className={styles["member-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>

      {errorMessage && <div role="alert">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles["search-bar"]}>
          {/* 工数区分定義Ver名 */}
          <div className={styles["search-bar-row"]}>
            <label htmlFor="kosu_name">工数区分定義Ver名:</label>
            <input
              type="text"
              id="kosu_name"
              name="kosu_name"
              value={formData.kosu_name}
              onChange={handleChange}
            />
          </div>

          {/* 動的に工数区分名と定義を描画 */}
          {formData.kosu_definitions.map((def, index) => (
            <div key={index} className={styles["search-bar-row"]}>
              <label htmlFor={`kosu_title_${index + 1}`}>{`工数区分名${index + 1}:`}</label>
              <input
                type="text"
                id={`kosu_title_${index + 1}`}
                value={def.title}
                onChange={(e) => handleChange(e, index, "title")}
              />

              <label htmlFor={`kosu_division_${index + 1}_1`}>{`定義${index + 1}:`}</label>
              <input
                type="text"
                id={`kosu_division_${index + 1}_1`}
                value={def.division1}
                onChange={(e) => handleChange(e, index, "division1")}
              />

              <label htmlFor={`kosu_division_${index + 1}_2`}>{`作業内容${index + 1}:`}</label>
              <input
                type="text"
                id={`kosu_division_${index + 1}_2`}
                value={def.division2}
                onChange={(e) => handleChange(e, index, "division2")}
              />
            </div>
          ))}

          <button type="submit" className="yellow_button">登録</button>
        </div>
      </form>
    </div>
  );
};

export default DefNew;