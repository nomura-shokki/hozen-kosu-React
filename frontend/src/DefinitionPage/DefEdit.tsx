// 必要なライブラリとコンポーネントのインポート
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefEdit.module.css";


interface KosuDefinition {
  title: string;
  division1: string;
  division2: string;
}

interface FormData {
  kosu_name: string;
  kosu_definitions: KosuDefinition[];
}

const DefEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, 
          { withCredentials: true }
        );
        const rawData = response.data;

        const kosu_definitions = Array.from({ length: 50 }, (_, i) => {
          const idx = i + 1;
          return {
            title: rawData[`kosu_title_${idx}`] || "",
            division1: rawData[`kosu_division_1_${idx}`] || "",
            division2: rawData[`kosu_division_2_${idx}`] || "",
          };
        });

        setFormData({ kosu_name: rawData.kosu_name || "", kosu_definitions });
        setLoading(false);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setErrorMessage(err.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof KosuDefinition
  ) => {
    const { name, value } = event.target;
    if (!formData) return;

    if (index !== undefined && field) {
      const updated = [...formData.kosu_definitions];
      updated[index] = { ...updated[index], [field]: value };
      setFormData({ ...formData, kosu_definitions: updated });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData) return;

    const confirmed = window.confirm(
      "工数区分定義を更新すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
    );
    if (!confirmed) return;

    const convertedData: { [key: string]: string } = {
      kosu_name: formData.kosu_name,
    };

    formData.kosu_definitions.forEach((def, index) => {
      const idx = index + 1;
      convertedData[`kosu_title_${idx}`] = def.title;
      convertedData[`kosu_division_1_${idx}`] = def.division1;
      convertedData[`kosu_division_2_${idx}`] = def.division2;
    });

    try {
      await axios.put(
        `${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, 
        convertedData, 
        { withCredentials: true }
      );
      alert("更新完了！");
      navigate("/def-list");
    } catch (err: any) {
      if (err.response && err.response.data) {
        setErrorMessage(err.response.data.error);
      } else {
        setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    }
  };

  if (!formData || !formData.kosu_definitions) return <div>データが見つかりません</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-edit-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義編集</h1>
        <nav className={styles["def-nav"]}>
          <Link to="/def-list">工数区分定義一覧</Link>
        </nav>

        {errorMessage && <div role="alert">{errorMessage}</div>}

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
            <button type="submit" className="green_button">更新</button>

            <label htmlFor="kosu_name">工数区分定義Ver名:</label>
            <input
              type="text"
              id="kosu_name"
              name="kosu_name"
              value={formData.kosu_name}
              onChange={(e) => handleChange(e)}
            />

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

export default DefEdit;