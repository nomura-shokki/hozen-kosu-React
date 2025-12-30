import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ItemSelect from "../components/ItemSelect";
import Loading from "../components/Loading";
import styles from "../styles/InquirPage/InquirNew.module.css";

interface FormData {
  content_choice: string;
  inquiry: string;
}

const InquirNew: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    content_choice: "",
    inquiry: "",
  });

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_new/`, { withCredentials: true });
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
    fetchData();
  }, [navigate]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleContentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormData((prevData) => ({
      ...prevData,
      content_choice: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_new/`, formData, { withCredentials: true });
      alert("登録完了！");

      setFormData({
        content_choice: "",
        inquiry: "",
      });
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

  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <div className={styles["inquir-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>問い合わせ</h1>
      <nav className={styles["inquir-nav"]}>
        <Link to="/inquir-menu">問い合わせMENU</Link>
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
          <label htmlFor="ItemSelect">内容選択:</label>
          <ItemSelect
            id="ItemSelect"
            name="content_choice"
            value={formData.content_choice}
            onChange={handleContentChange}
          />
          <label htmlFor="inquiry">問い合わせ：</label>
          <textarea
            id="inquiry"
            name="inquiry"
            value={formData.inquiry}
            onChange={handleChange}
            rows={5}
          />
          <button type="submit" className="pink_button">登録</button>
        </div>
      </form>
    </div>
  );
};

export default InquirNew;