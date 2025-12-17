import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefNew.module.css";


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
  const [formData, setFormData] = useState<FormData>({
    kosu_name: "",
    kosu_definitions: Array(50).fill({ title: "", division1: "", division2: "" }),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, { withCredentials: true })
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setErrorMessage(err.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
          setLoading(false);
      });
  }, [navigate]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof KosuDefinition
  ) => {
    const { name, value } = event.target;

    if (index !== undefined && field) {
      const updatedDefinitions = [...formData.kosu_definitions];
      updatedDefinitions[index] = {
        ...updatedDefinitions[index],
        [field]: value,
      };

      setFormData((prev) => ({
        ...prev,
        kosu_definitions: updatedDefinitions,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null); 

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

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/def_new/`, convertedData, { withCredentials: true })
      .then(() => {
        alert("登録完了！");
        navigate("/def-menu");
      })
      .catch((err) => {
        if (err.response && err.response.data) {
          setErrorMessage(err.response.data.error);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-new-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義登録</h1>

        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
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
    </>
  );
};

export default DefNew;