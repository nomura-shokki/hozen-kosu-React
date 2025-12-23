import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorHistoryDetail.module.css";

interface History {
  id: number;
  operation: string;
  table_name: string;
  record_id: string;
  login_No: string;
  changes: string;
  timestamp: string;
}

interface Response {
  history_data: History;
}

interface ChangesObject {
  [key: string]: any;
}

const HistoryDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<History | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<Response>(
          `${process.env.REACT_APP_API_BASE_URL}/api/manager_history_detail/${id}/`,
          { withCredentials: true }
        );
        const { history_data } = response.data;
        setFormData(history_data);
        setLoading(false);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.message);
        } else {
          setError("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight);
    };

    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
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
  }, [formData]);

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;
  if (!formData) return <div>データが見つかりません</div>;

  const handleDelete = async () => {
    const confirmed = window.confirm("削除しますか？");
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/api/manager_history_detail/${id}/`, {withCredentials: true});
      alert("削除しました");
      navigate("/manager-history");
    } catch (err) {
      alert("削除時にエラーが発生しました");
    }
  };

  const renderChanges = (changesString: string) => {
    if (!changesString || String(changesString).trim().length === 0) {
      return <div>変更なし</div>;
    }
    try {
      let validJsonString = changesString.replace(/'([^']+)':/g, '"$1":');
      validJsonString = validJsonString.replace(/True/g, 'true');
      validJsonString = validJsonString.replace(/False/g, 'false');
      validJsonString = validJsonString.replace(/None/g, 'null');
      validJsonString = validJsonString.replace(/'/g, '"');

      const changes: ChangesObject = JSON.parse(validJsonString);

      if (changes === null || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
        return <div>変更なし</div>;
      }

      const keys = Object.keys(changes);

      const formatValue = (data: any) => {
        if (data === null) {
          return 'None';
        }
        if (typeof data === 'boolean') {
          return data ? 'True' : 'False';
        }
        return String(data);
      };

      return (
        <>
          {keys.map((key) => {
            const value = changes[key];

            if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.old !== undefined && value.new !== undefined) {
              return (
                <div key={key}>
                  <p style={{ margin: "0", whiteSpace: "nowrap" }}>
                    <strong style={{ fontWeight: "bold" }}>{key}</strong>
                    : &#123;'old': {formatValue(value.old)}, 'new': {formatValue(value.new)}&#125;
                  </p>
                </div>
              );
            } else {
              return (
                <div key={key}>
                  <p style={{ margin: "0", whiteSpace: "nowrap" }}>
                    <strong style={{ fontWeight: "bold" }}>{key}</strong>
                    : {formatValue(value)}
                  </p>
                </div>
              );
            }
          })}
        </>
      );
    } catch (e) {
      console.error("Failed to parse changes JSON (after conversion attempts):", e);
      return <div><span style={{ color: 'red' }}>[パースエラー]</span> {changesString}</div>;
    }
  };

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>データ操作履歴詳細</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-history">データ操作履歴一覧</Link>
        </nav>

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
                <th className={styles["th-collar"]}>操作日時</th>
                <td className={styles["td-position"]}>{formData.timestamp}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>操作種類</th>
                <td className={styles["td-position"]}>{formData.operation}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>テーブル名</th>
                <td className={styles["td-position"]}>{formData.table_name}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>レコードID</th>
                <td className={styles["td-position"]}>{formData.record_id}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>従業員番号</th>
                <td className={styles["td-position"]}>{formData.login_No}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>編集内容</th>
                <td className={styles["td-position"]}>
                  {renderChanges(formData.changes)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button onClick={handleDelete} className="gray_button">
          削除
        </button>
      </div>
    </>
  );
};

export default HistoryDetail;