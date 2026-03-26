import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/DefinitionPage/DefDetailDelete.module.css";

interface Choice {
  id: number;
  def_symbol: string;
  def_select: string;
}

interface FetchResponse {
  formData: Choice;
  symbol_list: string[];
}

const MemberDelete: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<Choice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const fetchChoice = async () => {
      try {
        const response = await axios.get<FetchResponse>(`${process.env.REACT_APP_API_BASE_URL}/api/def_detail_update/${id}/`, { withCredentials: true });
        setRecord(response.data.formData);
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

    fetchChoice();
  }, [id, navigate]);

  useEffect(() => {
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight - 40);
    };

    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth + 5);
      }
    };

    updateMaxHeight();
    updateTableWidth();

    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [record]);

  const handleDelete = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/api/def_detail_delete/${id}/`, { withCredentials: true });
      alert("削除が完了しました");
      navigate("/def-detail-list");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;
  if (!record) return <div>データが見つかりません</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["choice-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>作業詳細選択肢削除</h1>
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        <p>以下の作業詳細データを削除しますか？</p>

        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          <table ref={tableRef}>
            <tbody>
              <tr>
                <th className={styles["th-collar"]}>定義記号</th>
                <td>{record.def_symbol}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>作業詳細</th>
                <td>{record.def_select}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button onClick={handleDelete} className="green_button">
          削除
        </button>
      </div>
    </>
  );
};

export default MemberDelete;