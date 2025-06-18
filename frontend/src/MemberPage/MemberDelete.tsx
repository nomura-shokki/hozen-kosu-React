import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";

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

  useEffect(() => {
    axios
      .get<Member>(`${process.env.REACT_APP_API_BASE_URL}/api/member_update/${employeeNo}/`, { withCredentials: true })
      .then((response) => {
        setRecord(response.data); 
        setLoading(false); // ロード状態を終了
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          // 認証エラーの際はログイン画面に遷移
          navigate("/login");
        } else {
          setError(err.message);
        }
        setLoading(false); // エラー発生時にもロード状態を終了
      });
  }, [employeeNo, navigate]);

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
    <div className="container mt-4">
      <nav className="mb-4">
        <Link to="/member-new" className="btn btn-primary me-2">新規登録</Link>
        <Link to="/member-list" className="btn btn-secondary">データ一覧</Link>
      </nav>

      <h1>人員データ削除</h1>
      <p>以下のデータを削除しますか？</p>

      <table className="table table-bordered">
        <tbody>
          <tr>
            <th>従業員番号</th>
            <td>{record.employee_no}</td>
          </tr>
          <tr>
            <th>氏名</th>
            <td>{record.name}</td>
          </tr>
          <tr>
            <th>ショップ</th>
            <td>{record.shop}</td>
          </tr>
          <tr>
            <th>権限</th>
            <td>{record.authority ? "有" : "無"}</td>
          </tr>
          <tr>
            <th>管理者権限</th>
            <td>{record.administrator ? "有" : "無"}</td>
          </tr>
        </tbody>
      </table>

      <button className="btn btn-danger" onClick={handleDelete}>
        削除
      </button>
    </div>
  );
};

export default MemberDelete;