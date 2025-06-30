import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import styles from "../styles/MemberPage/MemberDelete.module.css";

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

const MemberDelete: React.FC = () => {
  const { employee_no } = useParams<{ employee_no: string }>();
  const employeeNo = Number(employee_no);
  const navigate = useNavigate();
  const [record, setRecord] = useState<Member | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブルの幅を管理
  const tableRef = useRef<HTMLTableElement>(null); // テーブルを参照

  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/member_update/${employeeNo}/`, { withCredentials: true })
      .then((response) => {
        setRecord(response.data); 
        setLoading(false); // ロード状態を終了
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(err.message);
        }
        setLoading(false); // エラー発生時にもロード状態を終了
      });
  }, [employeeNo, navigate]);

  useEffect(() => {
    // テーブルの高さを更新
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight - 40); // 40pxは余白の調整値
    };

    // テーブルの幅を更新
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth + 5); // テーブル幅 + 5px
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
  }, [record]); // recordが変更されるたびに再計算

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!record) {
    return <div>データが見つかりません</div>;
  }

  const handleDelete = () => {
    axios
      .delete(`${process.env.REACT_APP_API_BASE_URL}/api/member_delete/${employeeNo}/`, { withCredentials: true })
      .then(() => {
        alert("データが削除されました");
        navigate("/member-list");
      })
      .catch((error) => {
        console.error(error);
        alert("エラーが発生しました");
      });
  };

  return (
    <div>
      <h1 className={styles["h1-collar"]}>人員削除</h1>
      <p>以下の人員のデータを削除しますか？</p>
      <nav className={styles["member-nav"]}>
        <Link to="/member-list">人員一覧</Link>
      </nav>

      <div
        className={styles["table-wrapper"]}
        style={{
          maxHeight: `${maxHeight}px`, // 動的な高さを設定
          width: `${tableWidth}px`,   // 動的な幅を設定
          overflowY: "auto",          // コンテンツが高さを超えた場合はスクロール
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
  );
};

export default MemberDelete;