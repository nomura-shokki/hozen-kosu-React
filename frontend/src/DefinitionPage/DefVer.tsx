import React, { useState, FormEvent, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/DefinitionPage/DefVer.module.css";
import DefVersionSelect from "../components/DefVersionSelect"; 

// 工数区分の選択肢アイテムの型
interface DefData {
  id: number;
  kosu_name: string;
}

// GET APIレスポンス全体の型
interface DefVerResponse {
  choices: DefData[];
  current_version: string;
}

const DefVer: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [choices, setChoices] = useState<DefData[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  // 初回マウント時に API からデータ取得
  useEffect(() => {
    axios
      .get<DefVerResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/def_ver/`, {
        withCredentials: true,
      })
      .then((response) => {
        setChoices(response.data.choices);
        setCurrentVersion(response.data.current_version);
        setSelectedVersion(response.data.current_version);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        }
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    axios
      .post(
        `${process.env.REACT_APP_API_BASE_URL}/api/def_ver/`,
        { versionchoice: selectedVersion },
        { withCredentials: true }
      )
      .then(() => {
        setCurrentVersion(selectedVersion);
        alert("切り替え完了！");
        setErrorMessage(null);
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

  const handleChangeVersion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersion(e.target.value);
  };

  // ローディング中
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles["defver-wrapper"]}>
      <h1 className={styles["h1-collar"]}>工数区分定義切り替え</h1>
      <nav className={styles["def-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>
      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}
      <p>現在の工数区分のVerは "{currentVersion}" です</p>
      <form 
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        <label htmlFor="versionchoice">工数区分の選択:</label>
        <DefVersionSelect 
          choices={choices}
          selectedVersion={selectedVersion}
          onChange={handleChangeVersion}
        />
        <div className={styles["search-button-row"]}>
          <button type="submit" className="green_button">工数区分定義切り替え</button>
        </div>
      </form>
    </div>
  );
};

export default DefVer;