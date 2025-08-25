// 必要なReact hooksやライブラリをインポート
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/DefinitionPage/DefNew.module.css";

// 単一の工数定義ブロック（タイトル、定義1、定義2）用の型
interface KosuDefinition {
  title: string;
  division1: string;
  division2: string;
}

// 全体のフォームデータ（工数定義Ver名 + 50件の定義）の型
interface FormData {
  kosu_name: string;
  kosu_definitions: KosuDefinition[];
}

const DefNew: React.FC = () => {
  // 初期状態：空のVer名 + 空の工数定義を50件分生成
  const [formData, setFormData] = useState<FormData>({
    kosu_name: "",
    kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラー表示用
  const navigate = useNavigate(); // ページ遷移用

  // 初回レンダリング時にAPI認証チェック（未ログインや権限なしを防止）
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, { withCredentials: true })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login"); // 未ログイン時
        } else if (err.response?.status === 403) {
          navigate("/"); // 権限なしの場合トップページへ
        } else {
          console.error("不明なエラー:", err); // その他例外
        }
      });
  }, [navigate]);

  // 入力項目変更ハンドラー（Ver名または各定義の入力対応）
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof KosuDefinition
  ) => {
    const { name, value } = event.target;

    if (index !== undefined && field) {
      // 工数定義ブロックの編集処理（特定インデックスのフィールドを更新）
      const updatedDefinitions = [...formData.kosu_definitions];
      updatedDefinitions[index] = {
        ...updatedDefinitions[index],
        [field]: value,
      };

      // 状態更新
      setFormData((prev) => ({
        ...prev,
        kosu_definitions: updatedDefinitions,
      }));
    } else {
      // 工数Ver名入力時の処理
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 登録処理：確認メッセージ後、APIへPOST送信
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null); // 送信前にエラーをリセット

    const confirmed = window.confirm(
      "工数区分定義を追加すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
    );
    if (!confirmed) {
      return; // ユーザーがキャンセルした場合は処理終了
    }

    // API送信用に形式を変換：key-value 形式へ
    const convertedData: { [key: string]: string } = {
      kosu_name: formData.kosu_name,
    };

    formData.kosu_definitions.forEach((def, index) => {
      const idx = index + 1;
      convertedData[`kosu_title_${idx}`] = def.title;
      convertedData[`kosu_division_1_${idx}`] = def.division1;
      convertedData[`kosu_division_2_${idx}`] = def.division2;
    });

    // APIへPOST送信（新規登録）
    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, convertedData, { withCredentials: true })
      .then(() => {
        alert("登録完了！"); // 成功時の通知
        navigate("/def-menu");
      })
      .catch((error) => {
        console.error(error);
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  return (
    <div className={styles["def-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数区分定義登録</h1>

      {/* ナビゲーションメニュー */}
      <nav className={styles["def-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>

      {/* エラーメッセージの表示 */}
      {errorMessage && <div role="alert">{errorMessage}</div>}

      {/* 登録フォーム */}
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
          <button type="submit" className="green_button">登録</button>

          {/* 工数定義Ver名入力 */}
          <label htmlFor="kosu_name">工数区分定義Ver名:</label>
          <input
            type="text"
            id="kosu_name"
            name="kosu_name"
            value={formData.kosu_name}
            onChange={handleChange}
          />

          {/* 50件分の工数区分の定義ブロックをレンダリング */}
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