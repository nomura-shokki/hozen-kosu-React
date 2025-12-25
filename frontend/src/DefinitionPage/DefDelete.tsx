import React, { useEffect, useState, useRef } from "react";
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
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

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

        setFormData({
          kosu_name: rawData.kosu_name || "",
          kosu_definitions,
        });
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(".search-bar") as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40);
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [formData]);

  const handleDelete = async () => {
    const confirmed = window.confirm("この工数区分定義を削除しますか？関連する工数入力に影響が出る可能性があります。");
    if (!confirmed) return;

    try {
      await axios.delete(
        `${process.env.REACT_APP_API_BASE_URL}/api/def_delete/${id}/`,
        { withCredentials: true }
      );
      alert("削除が完了しました");
      navigate("/def-menu");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div role="alert">Error: {error}</div>;
  if (!formData) return <div>定義が見つかりません</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義削除</h1>
        <p>以下の定義データを削除しますか？</p>

        <nav className={styles["def-nav"]}>
          <Link to="/def-list">工数区分定義一覧</Link>
        </nav>
        <button onClick={handleDelete} className="green_button">削除</button>
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            width: `${tableWidth + 20}px`,
          }}
        >
          <table ref={tableRef}>
            <tbody>
              <tr>
                <th className={styles["th-collar"]}>定義Ver名</th>
                <td className={styles["td-left"]}>{formData.kosu_name}</td>
              </tr>

              {formData.kosu_definitions.map((def, index) => (
                def.title || def.division1 || def.division2 ? (
                  <React.Fragment key={index}>
                    <tr>
                      <th className={index % 2 === 1 ? styles["th-collar"] : styles["th-collar-alt"]}>
                        工数区分名{index + 1}
                      </th>
                      <td className={styles["td-left"]}>{def.title.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</td>
                    </tr>
                    <tr>
                      <th className={index % 2 === 1 ? styles["th-collar"] : styles["th-collar-alt"]}>
                        定義{index + 1}
                      </th>
                      <td className={styles["td-left"]}>{def.division1.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</td>
                    </tr>
                    <tr>
                      <th className={index % 2 === 1 ? styles["th-collar"] : styles["th-collar-alt"]}>
                        作業内容{index + 1}
                      </th>
                      <td className={styles["td-left"]}>{def.division2.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</td>
                    </tr>
                  </React.Fragment>
                ) : null
              ))}

            </tbody>
          </table>
        </div>

        <button onClick={handleDelete} className="green_button">削除</button>
      </div>
    </>
  );
};

export default DefDelete;