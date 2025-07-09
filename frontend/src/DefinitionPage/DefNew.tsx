import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import styles from "../styles/DefinitionPage/DefNew.module.css";



// 工数定義の型：個別の区分データを表す
interface KosuDefinition {
  title: string;
  division1: string;
  division2: string;
}

// フォーム全体の型：バージョン名＋区分の配列
interface FormData {
  kosu_name: string;
  kosu_definitions: KosuDefinition[];
}

// 工数区分定義新規登録コンポーネント
const DefNew: React.FC = () => {
  // フォーム初期化
  const [formData, setFormData] = useState<FormData>({
    kosu_name: "",
    kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }),
  });

  // エラーメッセージの状態管理
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // 認証チェック：ページ初回表示時にGETリクエストを送信
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, { withCredentials: true })
      .catch((err) => {
        // 認証エラー時のリダイレクト処理
        if (err.response?.status === 401) {
          navigate('/login');
        } else if (err.response?.status === 403) {
          navigate('/');
        } else {
          console.error('不明なエラー:', err);
        }
      });
  }, [navigate]);

  // 入力変更時のハンドラー
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: string
  ) => {
    const { name, value } = event.target;

    // 個別定義フィールドが対象の場合
    if (index !== undefined && field) {
      const updatedDefinitions = [...formData.kosu_definitions];
      updatedDefinitions[index] = { ...updatedDefinitions[index], [field]: value };

      setFormData((prev) => ({
        ...prev,
        kosu_definitions: updatedDefinitions,
      }));
    } else {
      // 工数定義Ver名などの直接フィールド
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 登録ボタン押下時の送信処理
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    // ユーザーへの登録確認メッセージ
    const confirmed = window.confirm(
      "工数区分定義を追加すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
    );
    if (!confirmed) {
      return;
    }

    // バックエンド仕様に合わせてデータを整形（フラットな構造へ変換）
    const convertedData: { [key: string]: string } = {
      kosu_name: formData.kosu_name,
    };

    formData.kosu_definitions.forEach((def, index) => {
      const idx = index + 1;
      convertedData[`kosu_title_${idx}`] = def.title;
      convertedData[`kosu_division_1_${idx}`] = def.division1;
      convertedData[`kosu_division_2_${idx}`] = def.division2;
    });

    // 登録APIへのPOST送信
    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, convertedData, { withCredentials: true })
      .then(() => {
        alert('登録完了！');

        // 入力フォームの初期化処理
        setFormData({
          kosu_name: "",
          kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }),
        });
      })
      .catch((error) => {
        console.error(error);
        // エラー表示処理
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage('不明なエラーが発生しました。IT担当者に連絡してください。');
        }
      });
  };

  // JSXで画面レンダリング
  return (
    <div className={styles["def-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数区分定義登録</h1>
      <nav className={styles["def-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>

      {/* エラー表示欄 */}
      {errorMessage && <div role="alert">{errorMessage}</div>}

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Enterキーによる不意の送信を防止（textarea以外）
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'textarea') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        <div className={styles["search-bar"]}>
          <button type="submit" className="green_button">登録</button>

          {/* 工数区分定義Ver名入力欄 */}
          <label htmlFor="kosu_name">工数区分定義Ver名:</label>
          <input
            type="text"
            id="kosu_name"
            name="kosu_name"
            value={formData.kosu_name}
            onChange={handleChange}
          />

          {/* 工数定義（区分＋定義＋作業内容）の繰り返し入力欄 */}
          {formData.kosu_definitions.map((def, index) => (
            <div key={index} className={styles["definition-block"]}>
              <label htmlFor={`kosu_title_${index + 1}`}>{`工数区分名${index + 1}:`}</label>
              <input
                type="text"
                id={`kosu_title_${index + 1}`}
                value={def.title}
                onChange={(e) => handleChange(e, index, "title")}
              />

              <label htmlFor={`kosu_division_${index + 1}_1`}>{`定義${index + 1}:`}</label>
              <textarea
                id={`kosu_division_${index + 1}_1`}
                value={def.division1}
                onChange={(e) => handleChange(e, index, "division1")}
                rows={3}
              />

              <label htmlFor={`kosu_division_${index + 1}_2`}>{`作業内容${index + 1}:`}</label>
              <textarea
                id={`kosu_division_${index + 1}_2`}
                value={def.division2}
                onChange={(e) => handleChange(e, index, "division2")}
                rows={3}
              />
            </div>
          ))}

          <button type="submit" className="green_button">登録</button>
        </div>
      </form>
    </div>
  );
};

export default DefNew;