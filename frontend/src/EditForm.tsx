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

const EditForm: React.FC = () => {
  const { employee_no } = useParams<{ employee_no: string }>();
  const employeeNo = Number(employee_no); // 数値型に変換
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Member | null>(null);

  useEffect(() => {
    axios
      .get<Member>(`http://localhost:8000/api/member_update/${employeeNo}/`)
      .then((response) => {
        setFormData(response.data);
      })
      .catch((error) => {
        console.error(error);
        alert("指定したデータが見つかりません");
      });
  }, [employeeNo]);

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
      .then((response) => {
        console.log(response.data);
        alert("データが更新されました！");
        navigate("/data-list");
      })
      .catch((error) => {
        console.error(error);
        alert("エラーが発生しました");
      });
  };

  if (!formData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link to="/" className="btn btn-primary me-2">新規登録</Link>
        <Link to="/data-list" className="btn btn-secondary">データ一覧</Link>
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
          <label htmlFor="break_time1" className="form-label">
            1直昼休憩時間:
          </label>
          <input
            type="text"
            id="break_time1"
            name="break_time1"
            value={formData.break_time1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time1_over1" className="form-label">
            1直残業休憩時間1:
          </label>
          <input
            type="text"
            id="break_time1_over1"
            name="break_time1_over1"
            value={formData.break_time1_over1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time1_over2" className="form-label">
            1直残業休憩時間2:
          </label>
          <input
            type="text"
            id="break_time1_over2"
            name="break_time1_over2"
            value={formData.break_time1_over2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time1_over3" className="form-label">
            1直残業休憩時間3:
          </label>
          <input
            type="text"
            id="break_time1_over3"
            name="break_time1_over3"
            value={formData.break_time1_over3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time2" className="form-label">
            2直昼休憩時間:
          </label>
          <input
            type="text"
            id="break_time2"
            name="break_time2"
            value={formData.break_time2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time2_over1" className="form-label">
            2直残業休憩時間1:
          </label>
          <input
            type="text"
            id="break_time2_over1"
            name="break_time2_over1"
            value={formData.break_time2_over1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time2_over2" className="form-label">
            2直残業休憩時間2:
          </label>
          <input
            type="text"
            id="break_time2_over2"
            name="break_time2_over2"
            value={formData.break_time2_over2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time2_over3" className="form-label">
            2直残業休憩時間3:
          </label>
          <input
            type="text"
            id="break_time2_over3"
            name="break_time2_over3"
            value={formData.break_time2_over3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time3" className="form-label">
            3直昼休憩時間:
          </label>
          <input
            type="text"
            id="break_time3"
            name="break_time3"
            value={formData.break_time3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time3_over1" className="form-label">
            3直残業休憩時間1:
          </label>
          <input
            type="text"
            id="break_time3_over1"
            name="break_time3_over1"
            value={formData.break_time3_over1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time3_over2" className="form-label">
            3直残業休憩時間2:
          </label>
          <input
            type="text"
            id="break_time3_over2"
            name="break_time3_over2"
            value={formData.break_time3_over2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time3_over3" className="form-label">
            3直残業休憩時間3:
          </label>
          <input
            type="text"
            id="break_time3_over3"
            name="break_time3_over3"
            value={formData.break_time3_over3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time4" className="form-label">
            常昼昼休憩時間:
          </label>
          <input
            type="text"
            id="break_time4"
            name="break_time4"
            value={formData.break_time4}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time4_over1" className="form-label">
            常昼残業休憩時間1:
          </label>
          <input
            type="text"
            id="break_time4_over1"
            name="break_time4_over1"
            value={formData.break_time4_over1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time4_over2" className="form-label">
            常昼残業休憩時間2:
          </label>
          <input
            type="text"
            id="break_time4_over2"
            name="break_time4_over2"
            value={formData.break_time4_over2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time4_over3" className="form-label">
            常昼残業休憩時間3:
          </label>
          <input
            type="text"
            id="break_time4_over3"
            name="break_time4_over3"
            value={formData.break_time4_over3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time5" className="form-label">
            連1直昼休憩時間:
          </label>
          <input
            type="text"
            id="break_time5"
            name="break_time5"
            value={formData.break_time5}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time5_over1" className="form-label">
            連1直残業休憩時間1:
          </label>
          <input
            type="text"
            id="break_time5_over1"
            name="break_time5_over1"
            value={formData.break_time5_over1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time5_over2" className="form-label">
            連1直残業休憩時間2:
          </label>
          <input
            type="text"
            id="break_time5_over2"
            name="break_time5_over2"
            value={formData.break_time5_over2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time5_over3" className="form-label">
            連1直残業休憩時間3:
          </label>
          <input
            type="text"
            id="break_time5_over3"
            name="break_time5_over3"
            value={formData.break_time5_over3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time6" className="form-label">
            連2直昼休憩時間:
          </label>
          <input
            type="text"
            id="break_time6"
            name="break_time6"
            value={formData.break_time6}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time6_over1" className="form-label">
            連2直残業休憩時間1:
          </label>
          <input
            type="text"
            id="break_time6_over1"
            name="break_time6_over1"
            value={formData.break_time6_over1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time6_over2" className="form-label">
            連2直残業休憩時間2:
          </label>
          <input
            type="text"
            id="break_time6_over2"
            name="break_time6_over2"
            value={formData.break_time6_over2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_time6_over3" className="form-label">
            連2直残業休憩時間3:
          </label>
          <input
            type="text"
            id="break_time6_over3"
            name="break_time6_over3"
            value={formData.break_time6_over3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up1" className="form-label">
            ポップアップ1:
          </label>
          <input
            type="text"
            id="pop_up1"
            name="pop_up1"
            value={formData.pop_up1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up_id1" className="form-label">
            ポップアップID1:
          </label>
          <input
            type="text"
            id="pop_up_id1"
            name="pop_up_id1"
            value={formData.pop_up_id1}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up2" className="form-label">
            ポップアップ2:
          </label>
          <input
            type="text"
            id="pop_up2"
            name="pop_up2"
            value={formData.pop_up2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up_id2" className="form-label">
            ポップアップID2:
          </label>
          <input
            type="text"
            id="pop_up_id2"
            name="pop_up_id2"
            value={formData.pop_up_id2}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up3" className="form-label">
            ポップアップ3:
          </label>
          <input
            type="text"
            id="pop_up3"
            name="pop_up3"
            value={formData.pop_up3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up_id3" className="form-label">
            ポップアップID3:
          </label>
          <input
            type="text"
            id="pop_up_id3"
            name="pop_up_id3"
            value={formData.pop_up_id3}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up4" className="form-label">
            ポップアップ4:
          </label>
          <input
            type="text"
            id="pop_up4"
            name="pop_up4"
            value={formData.pop_up4}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up_id4" className="form-label">
            ポップアップID4:
          </label>
          <input
            type="text"
            id="pop_up_id4"
            name="pop_up_id4"
            value={formData.pop_up_id4}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up5" className="form-label">
            ポップアップ5:
          </label>
          <input
            type="text"
            id="pop_up5"
            name="pop_up5"
            value={formData.pop_up5}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pop_up_id5" className="form-label">
            ポップアップID5:
          </label>
          <input
            type="text"
            id="pop_up_id5"
            name="pop_up_id5"
            value={formData.pop_up_id5}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="break_check" className="form-label">
            休憩エラー有効チェック:
          </label>
          <input
            type="checkbox" // チェックボックス入力
            id="break_check"
            name="break_check"
            checked={formData.break_check}
            onChange={handleChange}
            className="form-check-input"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="def_prediction" className="form-label">
            工数定義区分予測無効:
          </label>
          <input
            type="checkbox" // チェックボックス入力
            id="def_prediction"
            name="def_prediction"
            checked={formData.def_prediction}
            onChange={handleChange}
            className="form-check-input"
          />
        </div>

        <button type="submit" className="btn btn-primary">更新</button>
      </form>
    </div>
  );
};

export default EditForm;