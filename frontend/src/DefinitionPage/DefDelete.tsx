import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefDelete.module.css";

interface KosuDefinition {
  title: string;
  division1: string;
  division2: string;
}

interface FormData {
  kosu_name: string;
  kosu_definitions: KosuDefinition[];
}

const DefDelete: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/def_update/${id}/`, { withCredentials: true })
      .then((response) => {
        const rawData = response.data;

        const kosu_definitions = Array.from({ length: 50 }, (_, i) => {
          const idx = i + 1;
          return {
            title: rawData[`kosu_title_${idx}`] || "",
            division1: rawData[`kosu_division_1_${idx}`] || "",
            division2: rawData[`kosu_division_2_${idx}`] || "",
          };
        });

        setFormData({
          kosu_name: rawData.kosu_name || "",
          kosu_definitions,
        });

        setLoading(false);
        setTimeout(() => setIsLoading(false), 500);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError("データ取得に失敗しました");
        }
        setLoading(false);
        setTimeout(() => setIsLoading(false), 500);
      });
  }, [id, navigate]);

  const handleDelete = () => {
    const confirmed = window.confirm("この工数区分定義を削除しますか？関連する工数入力に影響が出る可能性があります。");
    if (!confirmed) return;

    axios
      .delete(`${process.env.REACT_APP_API_BASE_URL}/api/def_delete/${id}/`, { withCredentials: true })
      .then(() => {
        alert("削除が完了しました");
        navigate("/def-menu");
      })
      .catch((error) => {
        console.error(error);
        alert("削除時にエラーが発生しました");
      });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div role="alert">Error: {error}</div>;
  if (!formData) return <div>定義が見つかりません</div>;

  return (
    <>
      <Loading isLoading={isLoading} />
      <div className={styles["def-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義削除</h1>
        <p>以下の定義データを削除しますか？</p>

        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        <div className={styles["delete-table-wrapper"]}>
          <button onClick={handleDelete} className="green_button">削除</button>
          <table className={styles["def-table"]}>
            <tbody>
              <tr>
                <th className={styles["th-collar"]}>定義Ver名</th>
                <td>{formData.kosu_name}</td>
              </tr>
            </tbody>
          </table>

          {/* 各工数区分定義を表示 */}
          {formData.kosu_definitions.map((def, index) => (
            def.title || def.division1 || def.division2 ? (
              <table key={index} className={styles["def-table"]}>
                <tbody>
                  <tr>
                    <th className={styles["th-collar"]}>工数区分名{index + 1}</th>
                    <td>{def.title}</td>
                  </tr>
                  <tr>
                    <th className={styles["th-collar"]}>定義{index + 1}</th>
                    <td>{def.division1}</td>
                  </tr>
                  <tr>
                    <th className={styles["th-collar"]}>作業内容{index + 1}</th>
                    <td>{def.division2}</td>
                  </tr>
                </tbody>
              </table>
            ) : null
          ))}
        </div>

        <button onClick={handleDelete} className="green_button">削除</button>
      </div>
    </>
  );
};

export default DefDelete;
