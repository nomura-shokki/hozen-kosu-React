import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
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

  const [formData, setFormData] = useState<FormData>({
    kosu_name: "",
    kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }),
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<FormData>(
          `${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`,
          { withCredentials: true }
        );
        if (response.data) {
          setFormData(response.data);
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            navigate("/login");
          } else if (err.response?.status === 403) {
            navigate("/");
          } else {
            setError("データの取得中にエラーが発生しました");
          }
        } else {
          setError("予期しないエラーが発生しました");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: string
  ) => {
    const { name, value } = event.target;

    if (index !== undefined && field) {
      const updatedDefinitions = [...formData.kosu_definitions];
      updatedDefinitions[index] = { ...updatedDefinitions[index], [field]: value };

      setFormData((prev) => ({
        ...prev!,
        kosu_definitions: updatedDefinitions,
      }));
    } else {
      setFormData((prev) => ({
        ...prev!,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const confirmed = window.confirm(
      "工数区分定義を更新すると全人員の工数入力に影響します。この変更を慎重に行ってください。"
    );
    if (!confirmed) return;

    axios
      .put(`${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, formData, { withCredentials: true })
      .then(() => {
        alert("更新完了！");
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

  if (loading) {
    return <div className={styles["loading-wrapper"]}><p>データを読み込んでいます...</p></div>;
  }

  if (error) {
    return <div className={styles["error-wrapper"]}><p>{error}</p></div>;
  }

  return (
    <div className={styles["def-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数区分定義編集</h1>
      <nav className={styles["def-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>

      {errorMessage && <div role="alert">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles["search-bar"]}>
          <label htmlFor="kosu_name">工数区分定義Ver名:</label>
          <input
            type="text"
            id="kosu_name"
            name="kosu_name"
            value={formData.kosu_name}
            onChange={handleChange}
          />

          {formData.kosu_definitions && formData.kosu_definitions.length > 0 ? (
            formData.kosu_definitions.map((def, index) => (
              <div key={index} className={styles["definition-block"]}>
                <label htmlFor={`kosu_title_${index + 1}`}>{`工数区分名${index + 1}:`}</label>
                <input
                  type="text"
                  id={`kosu_title_${index + 1}`}
                  value={def.title}
                  onChange={(e) => handleChange(e, index, "title")}
                />
                <label>{`定義${index + 1}:`}</label>
                <textarea
                  value={def.division1}
                  onChange={(e) => handleChange(e, index, "division1")}
                  rows={3}
                />
                <label>{`作業内容${index + 1}:`}</label>
                <textarea
                  value={def.division2}
                  onChange={(e) => handleChange(e, index, "division2")}
                  rows={3}
                />
              </div>
            ))
          ) : <p>データがありません</p>}
          <button type="submit">更新</button>
        </div>
      </form>
    </div>
  );
};

export default DefEdit;