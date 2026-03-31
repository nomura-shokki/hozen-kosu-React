import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/DefinitionPage/DefDetailNew.module.css";

interface FormData {
  def_symbol: string;
  def_select: string;
}

const DefDetailNew: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    def_symbol: "",
    def_select: "",
  });

  const [defData, setDefData] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get("/api/def_detail_new/");
        setDefData(response.data);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const getSymbolOptions = () => {
    if (!defData) return [];

    let maxIndex = 0;
    for (let i = 1; i <= 50; i++) {
      if (defData[`kosu_title_${i}`]) {
        maxIndex = i;
      }
    }

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";
    const options = [];

    for (let i = 0; i < maxIndex; i++) {
      if (alphabet[i]) {
        options.push({ value: alphabet[i], label: alphabet[i] });
      }
    }
    options.push({ value: "$", label: "$" });
    return options;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    if (type === "checkbox") {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await api.post("/api/def_detail_new/", formData);
      alert("登録完了！");

      setFormData({
        def_symbol: "",
        def_select: "",
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;

  const symbolOptions = getSymbolOptions();

  return (
    <div className={styles["choice-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>作業詳細選択肢登録</h1>
      <nav className={styles["def-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>

      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

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
          <label htmlFor="def_symbol">定義記号:</label>
          <select
            id="def_symbol"
            name="def_symbol"
            value={formData.def_symbol}
            onChange={handleChange}
            className={styles["select-input"]}
          >
            <option value="">選択してください</option>
            {symbolOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label htmlFor="def_select">作業詳細:</label>
          <input
            type="text"
            id="def_select"
            name="def_select"
            value={formData.def_select}
            onChange={handleChange}
          />
          <button type="submit" className="green_button">登録</button>
        </div>
      </form>
    </div>
  );
};

export default DefDetailNew;