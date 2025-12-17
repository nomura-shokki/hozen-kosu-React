import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorTaskDetail.module.css";

interface Task {
  id: number;
  task_id: string;
  status: string;
  result: string;
  created_at: string;
  updated_at: string;
}

interface Response {
  task_data: Task;
}

const TaskDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<Task | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_task_detail/${id}/`, { withCredentials: true })
      .then((response) => {
        const { task_data } = response.data;
        setFormData(task_data); 
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
          setLoading(false);
      });
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

  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const handleDelete = () => {
    const confirmed = window.confirm("削除しますか？");
    if (!confirmed) {
      return;
    }

    axios
      .delete(`${process.env.REACT_APP_API_BASE_URL}/api/manager_task_detail/${id}/`, { withCredentials: true })
      .then(() => {
        alert("削除が完了しました");
        navigate("/manager-task");
      })
      .catch((err) => {
        console.error(err);
        alert("削除時にエラーが発生しました");
      });
  };

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>非同期タスク詳細</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-task">非同期タスクデータ一覧</Link>
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
                <th className={styles["th-collar"]}>作成日時</th>
                <td>{formData.created_at}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>最終編集日時</th>
                <td>{formData.updated_at}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>タスクID</th>
                <td>{formData.task_id}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>状態</th>
                <td>{formData.status}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>結果</th>
                <td>{formData.result}</td>
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

export default TaskDetail;