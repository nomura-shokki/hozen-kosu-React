// 必要なライブラリとコンポーネントのインポート
import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefEdit.module.css";

// 工数定義1セット分の型定義（50個生成される）
interface KosuDefinition {
  title: string;
  division1: string;
  division2: string;
}

// 全体のフォームデータの型定義（工数Ver名＋各定義）
interface FormData {
  kosu_name: string;
  kosu_definitions: KosuDefinition[];
}

const DefEdit: React.FC = () => {
  // URLパラメータからID取得
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 状態管理：formDataに取得結果を格納。エラーメッセージやローディング制御も追加。
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true); // 初回レンダリング前処理のフラグ
  const [isLoading, setIsLoading] = useState(true); // ローディングアニメーション制御
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 初回レンダリング時にAPIから定義データ取得
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const rawData = response.data;

        // 工数定義50個分のデータをまとめて構築
        const kosu_definitions = Array.from({ length: 50 }, (_, i) => {
          const idx = i + 1;
          return {
            title: rawData[`kosu_title_${idx}`] || "",
            division1: rawData[`kosu_division_1_${idx}`] || "",
            division2: rawData[`kosu_division_2_${idx}`] || "",
          };
        });

        // 取得したデータを状態に反映
        setFormData({ kosu_name: rawData.kosu_name || "", kosu_definitions });
        setLoading(false);
        setTimeout(() => setIsLoading(false), 500); // ローディングアニメーションの遅延解除
      })
      .catch((err) => {
        // 権限チェック：未ログイン・権限なしは画面遷移
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          console.error("不明なエラー:", err);
        }
        setLoading(false);
        setTimeout(() => setIsLoading(false), 500);
      });
  }, [id, navigate]);

  // 入力値の変更ハンドラー（工数Ver名 or 各定義ブロック）
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof KosuDefinition
  ) => {
    const { name, value } = event.target;
    if (!formData) return;

    // 各定義項目の変更（indexとfield指定時）
    if (index !== undefined && field) {
      const updated = [...formData.kosu_definitions];
      updated[index] = { ...updated[index], [field]: value };
      setFormData({ ...formData, kosu_definitions: updated });
    } else {
      // 工数Ver名の変更
      setFormData({ ...formData, [name]: value });
    }
  };

  // 更新ボタン押下時の送信処理
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData) return;

    // 更新の影響確認アラート
    const confirmed = window.confirm(
      "工数区分定義を更新すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
    );
    if (!confirmed) return;

    // バックエンド送信用に変換（key-value形式）
    const convertedData: { [key: string]: string } = {
      kosu_name: formData.kosu_name,
    };

    formData.kosu_definitions.forEach((def, index) => {
      const idx = index + 1;
      convertedData[`kosu_title_${idx}`] = def.title;
      convertedData[`kosu_division_1_${idx}`] = def.division1;
      convertedData[`kosu_division_2_${idx}`] = def.division2;
    });

    // PUTで更新送信、結果に応じた処理分岐
    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, convertedData, { withCredentials: true })
      .then(() => {
        alert("更新完了！");
        navigate("/def-list"); // 定義メニュー画面へ遷移
      })
      .catch((error) => {
        console.error(error);
        if (error.response?.data?.error) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  // ローディング状態の表示
  if (loading) return <div>Loading...</div>;

  // データ取得失敗時の表示
  if (!formData || !formData.kosu_definitions) return <div>データが見つかりません</div>;

  return (
    <>
      {/* ローディングアニメーション */}
      <Loading isLoading={isLoading} />

      <div className={styles["def-edit-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義編集</h1>

        {/* ナビゲーション */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-list">工数区分定義一覧</Link>
        </nav>

        {/* エラーメッセージ表示 */}
        {errorMessage && <div role="alert">{errorMessage}</div>}

        {/* 編集フォーム */}
        <form onSubmit={handleSubmit}>
          <div className={styles["search-bar"]}>
            {/* 上部・下部に更新ボタン重複配置 */}
            <button type="submit" className="green_button">更新</button>

            {/* 工数Ver名入力 */}
            <label htmlFor="kosu_name">工数区分定義Ver名:</label>
            <input
              type="text"
              id="kosu_name"
              name="kosu_name"
              value={formData.kosu_name}
              onChange={(e) => handleChange(e)}
            />

            {/* 定義項目群のマッピング表示 */}
            {formData.kosu_definitions.map((def, index) => (
              <div key={index} className={styles["definition-block"]}>
                {/* 工数区分名入力 */}
                <label htmlFor={`kosu_title_${index + 1}`}>{`工数区分名${index + 1}:`}</label>
                <input
                  type="text"
                  id={`kosu_title_${index + 1}`}
                  value={def.title}
                  onChange={(e) => handleChange(e, index, "title")}
                />

                {/* 定義1（概要）入力 */}
                <label htmlFor={`kosu_division_${index + 1}_1`}>{`定義${index + 1}:`}</label>
                <textarea
                  id={`kosu_division_${index + 1}_1`}
                  value={def.division1}
                  onChange={(e) => handleChange(e, index, "division1")}
                  rows={3}
                />

                {/* 定義2（詳細内容）入力 */}
                <label htmlFor={`kosu_division_${index + 1}_2`}>{`作業内容${index + 1}:`}</label>
                <textarea
                  id={`kosu_division_${index + 1}_2`}
                  value={def.division2}
                  onChange={(e) => handleChange(e, index, "division2")}
                  rows={3}
                />
              </div>
            ))}

            {/* 更新ボタン（ページ下部） */}
            <button type="submit" className="green_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default DefEdit;