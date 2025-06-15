import React, { useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import ShopSelect from '../components/ShopSelect';
import { Link } from 'react-router-dom';

interface FormData {
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

const MemberNew: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    employee_no: 0,
    name: '',
    shop: '',
    authority: false,
    administrator: false,
    break_time1: '#00000000',
    break_time1_over1: '#00000000',
    break_time1_over2: '#00000000',
    break_time1_over3: '#00000000',
    break_time2: '#00000000',
    break_time2_over1: '#00000000',
    break_time2_over2: '#00000000',
    break_time2_over3: '#00000000',
    break_time3: '#00000000',
    break_time3_over1: '#00000000',
    break_time3_over2: '#00000000',
    break_time3_over3: '#00000000',
    break_time4: '#00000000',
    break_time4_over1: '#00000000',
    break_time4_over2: '#00000000',
    break_time4_over3: '#00000000',
    break_time5: '#00000000',
    break_time5_over1: '#00000000',
    break_time5_over2: '#00000000',
    break_time5_over3: '#00000000',
    break_time6: '#00000000',
    break_time6_over1: '#00000000',
    break_time6_over2: '#00000000',
    break_time6_over3: '#00000000',
    pop_up1: '',
    pop_up_id1: '',
    pop_up2: '',
    pop_up_id2: '',
    pop_up3: '',
    pop_up_id3: '',
    pop_up4: '',
    pop_up_id4: '',
    pop_up5: '',
    pop_up_id5: '',
    break_check: false,
    def_prediction: false,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    if (type === 'checkbox') {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null); // エラーメッセージをリセット
    axios
      .post('http://localhost:8000/api/member_new/', formData)
      .then((response) => {
        console.log(response.data);
        alert('登録完了！');
      })
      .catch((error) => {
        console.error(error);
        // サーバーからのエラーメッセージを取得
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage('不明なエラーが発生しました。IT担当者に連絡してください。');
        }
      });
  };

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link to="/member-new" className="btn btn-primary me-2">新規登録</Link>
        <Link to="/member-list" className="btn btn-secondary">データ一覧</Link>
      </nav>

      <h1>メンバー新規登録</h1>

      {/* エラーメッセージを表示 */}
      {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

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
          <ShopSelect
            name="shop"
            value={formData.shop}
            onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
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

        <button type="submit" className="btn btn-primary">登録</button>
      </form>
    </div>
  );
};

export default MemberNew;