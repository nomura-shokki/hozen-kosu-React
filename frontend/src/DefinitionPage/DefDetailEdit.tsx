import React, { useState, useEffect, FormEvent } from "react";
import api from "../api/axios";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/DefinitionPage/DefDetailEdit.module.css"; 

interface Choice {
  id: number;
  def_symbol: string;
  def_select: string;
}

interface FetchResponse {
  formData: Choice;
  symbol_list: string[];
}

const DefDetailEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<Choice | null>(null);
  const [symbolList, setSymbolList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchChoice = async () => {
      try {
        const response = await api.get<FetchResponse>(`/api/def_detail_update/${id}/`);
        setFormData(response.data.formData);
        setSymbolList(response.data.symbol_list);
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

    fetchChoice();
  }, [id, navigate]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await api.put(`/api/def_detail_update/${id}/`,
        formData
      );
      alert("データが更新されました！");
      navigate("/def-detail-list");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (errorMessage) return <div>Error: {errorMessage}</div>;
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["choice-edit-wrapper"]}>
        <h1 className={styles["h1-collar"]}>作業詳細選択肢編集</h1>
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
            >
              <option value="">選択してください</option>
              {symbolList.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
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

            <button type="submit" className="green_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default DefDetailEdit;