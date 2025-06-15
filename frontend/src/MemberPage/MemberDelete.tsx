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
  const employeeNo = Number(employee_no); // number 型に変換
  const navigate = useNavigate();
  const [record, setRecord] = useState<Member | null>(null);

  useEffect(() => {
    axios
      .get<Member>(`http://localhost:8000/api/member_update/${employeeNo}/`)
      .then((response) => {
        setRecord(response.data);
      })
      .catch((error) => {
        console.error(error);
        alert("指定したデータが見つかりません");
        navigate("/data-list");
      });
  }, [employeeNo, navigate]);

  const handleDelete = () => {
    axios
      .delete(`http://localhost:8000/api/member_delete/${employeeNo}/`)
      .then(() => {
        alert("データが削除されました");
        navigate("/member-list");
      })
      .catch((error) => {
        console.error(error);
        alert("エラーが発生しました");
      });
  };

  if (!record) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link to="/member-new" className="btn btn-primary me-2">新規登録</Link>
        <Link to="/member-list" className="btn btn-secondary">データ一覧</Link>
      </nav>

      <h1>削除確認</h1>
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
        削除する
      </button>
    </div>
  );
};

export default MemberDelete;