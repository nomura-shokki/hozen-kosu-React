import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
  break_time1: string;
  break_time1_over1: string;
  break_time1_over2: string;
  break_time1_over3: string;
  break_time2: string;
  break_time2_over1: string;
  break_time2_over2: string;
  break_time2_over3: string;
  break_time3: string;
  break_time3_over1: string;
  break_time3_over2: string;
  break_time3_over3: string;
  break_time4: string;
  break_time4_over1: string;
  break_time4_over2: string;
  break_time4_over3: string;
  break_time5: string;
  break_time5_over1: string;
  break_time5_over2: string;
  break_time5_over3: string;
  break_time6: string;
  break_time6_over1: string;
  break_time6_over2: string;
  break_time6_over3: string;
  pop_up1: string;
  pop_up_id1: string;
  pop_up2: string;
  pop_up_id2: string;
  pop_up3: string;
  pop_up_id3: string;
  pop_up4: string;
  pop_up_id4: string;
  pop_up5: string;
  pop_up_id5: string;
  break_check: boolean;
  def_prediction: boolean;
}

const MemberEdit: React.FC = () => {
  const { employee_no } = useParams<{ employee_no: string }>();
  const employeeNo = Number(employee_no);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<Member | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<Member>(`http://localhost:8000/api/member_update/${employeeNo}/`)
      .then((response) => {
        setFormData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [employeeNo]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) =>
      prev ? { ...prev, [name]: type === "checkbox" ? checked : value } : prev
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    axios
      .put(`http://localhost:8000/api/member_update/${employeeNo}/`, formData)
      .then(() => {
        alert("データが更新されました！");
        navigate("/member-list");
      })
      .catch((error) => {
        setError(error.message);
      });
  };

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link to="/member-new" className="btn btn-primary me-2">新規登録</Link>
        <Link to="/member-list" className="btn btn-secondary">データ一覧</Link>
      </nav>
      <h1>編集画面</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="employee_no" className="form-label">従業員番号:</label>
          <input
            type="number"
            id="employee_no"
            name="employee_no"
            value={formData.employee_no}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="name" className="form-label">氏名:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="shop" className="form-label">ショップ:</label>
          <input
            type="text"
            id="shop"
            name="shop"
            value={formData.shop}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="authority" className="form-label">権限:</label>
          <input
            type="checkbox"
            id="authority"
            name="authority"
            checked={formData.authority}
            onChange={handleChange}
            className="form-check-input"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="administrator" className="form-label">管理者権限:</label>
          <input
            type="checkbox"
            id="administrator"
            name="administrator"
            checked={formData.administrator}
            onChange={handleChange}
            className="form-check-input"
          />
        </div>

        <button type="submit" className="btn btn-primary">更新</button>
      </form>
    </div>
  );
};

export default MemberEdit;