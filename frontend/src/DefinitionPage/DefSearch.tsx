import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/DefinitionPage/DefSearch.module.css";


interface DivisionData {
  id: number;
  kosu_title_1?: string | null;
  kosu_division_1_1?: string | null;
  kosu_division_2_1?: string | null;
  [key: string]: any;
}

const DefSearch: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<DivisionData[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDef1, setSelectedDef1] = useState<string | null>("");
  const [selectedDef2, setSelectedDef2] = useState<string | null>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<DivisionData[]>(`${process.env.REACT_APP_API_BASE_URL}/api/def_search//`, {withCredentials: true});
        setDivisions(response.data);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTitle = event.target.value;
    setSelectedDivision(selectedTitle);

    if (selectedTitle) {
      let found = false;
      divisions.forEach((division) => {
        for (let i = 1; i <= 50; i++) {
          if (division[`kosu_title_${i}`] === selectedTitle) {
            setSelectedDef1(division[`kosu_division_1_${i}`]);
            setSelectedDef2(division[`kosu_division_2_${i}`]);
            found = true;
            break;
          }
        }
        if (found) {
          return;
        }
      });
    } else {
      setSelectedDef1("");
      setSelectedDef2("");
    }
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-search-wrapper"]}>
        <h1 className={styles["h1-collar"]}>工数区分定義確認</h1>
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        <form>
          <div className={styles["search-bar"]}>
            <label htmlFor="division-select">定義確認する工数区分選択:</label>
            <select
              id="division-select"
              name="division-select"
              value={selectedDivision}
              onChange={handleSelectChange}
            >
              <option value="">選択してください</option>
              {divisions.length > 0 ? (
                divisions.flatMap((division) => {
                  return Array.from({ length: 50 }).map((_, i) => {
                    const title = division[`kosu_title_${i + 1}`];
                    return (
                      title && (
                        <option key={`${division.id}-${i}`} value={title}>
                          {title}
                        </option>
                      )
                    );
                  });
                })
              ) : (
                <option disabled>データが存在しません</option>
              )}
            </select>
          </div>
        </form>

        <div className={styles["definition-content"]}>
          <h2>定義:</h2> 
          <p>{selectedDef1 || "該当する定義がありません"}</p>

          <h2>作業内容:</h2>
          <p>{selectedDef2 || "該当する作業内容がありません"}</p>
        </div>
      </div>
    </>
  );
};

export default DefSearch;