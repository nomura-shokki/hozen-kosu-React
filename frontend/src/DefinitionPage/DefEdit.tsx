import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefEdit.module.css";



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

// 工数区分定義編集コンポーネント
const DefEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // URLパラメータからID取得
  const navigate = useNavigate(); // ページ遷移用フック

  const [formData, setFormData] = useState<FormData | null>(null); // 編集フォームのデータ
  const [loading, setLoading] = useState(true); // 初回読み込み制御
  const [isLoading, setIsLoading] = useState(true); // ローディング画面用制御
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラー表示

  // コンポーネント初回描画時にバックエンドから定義データ取得
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const rawData = response.data;
        // APIレスポンスの形式をKosuDefinitionの配列に変換（最大50区分）
        const kosu_definitions = Array.from({ length: 50 }, (_, i) => {
          const idx = i + 1;
          return {
            title: rawData[`kosu_title_${idx}`] || "",
            division1: rawData[`kosu_division_1_${idx}`] || "",
            division2: rawData[`kosu_division_2_${idx}`] || "",
          };
        });
        // データをstateに反映
        setFormData({ kosu_name: rawData.kosu_name || "", kosu_definitions });
        setLoading(false);
        setTimeout(() => setIsLoading(false), 500); // ローディング終了タイミング調整
      })
      .catch((err) => {
        // 認証・権限系のエラーハンドリング
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

  // 入力フォームの変更処理（区分Ver名または各項目の変更を反映）
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof KosuDefinition
  ) => {
    const { name, value } = event.target;
    if (!formData) return;

    // 定義項目（title, division1, division2）の更新
    if (index !== undefined && field) {
      const updated = [...formData.kosu_definitions];
      updated[index] = { ...updated[index], [field]: value };
      setFormData({ ...formData, kosu_definitions: updated });
    } else {
      // kosu_nameなどの更新
      setFormData({ ...formData, [name]: value });
    }
  };

  // 登録ボタン押下時の送信処理（PUTで更新）
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData) return;

    // ユーザーへの事前確認メッセージ
    const confirmed = window.confirm(
      "工数区分定義を更新すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
    );
    if (!confirmed) return;

    // 送信形式をAPIに合わせてフラットに整形
    const convertedData: { [key: string]: string } = {
      kosu_name: formData.kosu_name,
    };

    // 50区分分を分解してkey-value形式で構築
    formData.kosu_definitions.forEach((def, index) => {
      const idx = index + 1;
      convertedData[`kosu_title_${idx}`] = def.title;
      convertedData[`kosu_division_1_${idx}`] = def.division1;
      convertedData[`kosu_division_2_${idx}`] = def.division2;
    });

    // PUTリクエストで更新送信
    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, convertedData, { withCredentials: true })
      .then(() => {
        alert("更新完了！");
        navigate("/def-menu"); // MENU画面へリダイレクト
      })
      .catch((error) => {
        console.error(error);
        // エラー内容の表示（APIエラーメッセージに応じて）
        if (error.response?.data?.error) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  // 初期ロード表示（データ取得前）
  if (loading) return <div>Loading...</div>;
  if (!formData || !formData.kosu_definitions) return <div>データが見つかりません</div>;

  // メイン画面の描画処理
  return (
    <>
      <Loading isLoading={isLoading} /> {/* 読み込み中はローディング表示 */}
      <div className={styles["def-edit-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義編集</h1>
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {/* エラーがあれば表示 */}
        {errorMessage && <div role="alert">{errorMessage}</div>}

        {/* フォーム本体 */}
        <form onSubmit={handleSubmit}>
          <div className={styles["search-bar"]}>
            <button type="submit" className="green_button">更新</button>
            <label htmlFor="kosu_name">工数区分定義Ver名:</label>
            <input
              type="text"
              id="kosu_name"
              name="kosu_name"
              value={formData.kosu_name}
              onChange={(e) => handleChange(e)}
            />

            {/* 工数定義項目をループ描画 */}
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

            <button type="submit" className="green_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

// コンポーネントのエクスポート
export default DefEdit;