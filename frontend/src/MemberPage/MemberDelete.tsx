import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/MemberPage/MemberDelete.module.css";

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

const MemberDelete: React.FC = () => {
  const navigate = useNavigate();
  const { employee_no } = useParams<{ employee_no: string }>();
  const employeeNo = Number(employee_no);
  const [record, setRecord] = useState<Member | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await axios.get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/member_update/${employeeNo}/`, { withCredentials: true });
        setRecord(response.data);
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

    fetchMember();
  }, [employeeNo, navigate]);

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
    const confirmed = window.confirm("人員情報を削除すると該当人員の工数入力が見えなくなります。特別な意図がない場合は人員情報の編集でショップ選択を退社に変えるのみにして下さい。削除しますか？");
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/api/member_delete/${employeeNo}/`, { withCredentials: true });
      alert("削除が完了しました");
      navigate("/member-list");
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
      <div className={styles["member-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>人員削除</h1>
        <p>以下の人員のデータを削除しますか？</p>
        <nav className={styles["member-nav"]}>
          <Link to="/member-list">人員一覧</Link>
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
                <th className={styles["th-collar"]}>従業員番号</th>
                <td>{record.employee_no}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>氏名</th>
                <td>{record.name}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>ショップ</th>
                <td>{record.shop}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>権限</th>
                <td>{record.authority ? "有" : "無"}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>管理者権限</th>
                <td>{record.administrator ? "有" : "無"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button onClick={handleDelete} className="yellow_button">
          削除
        </button>
      </div>
    </>
  );
};

export default MemberDelete;