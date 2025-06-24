import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from "../styles/MainPage/Login.module.css";


const Login: React.FC = () => {
  const [employee_no, setNumber] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/login/`,
        { employee_no: Number(employee_no) },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      const data = response.data;

      if (data.status === 'success') {
        navigate('/');
      } else {
        setErrorMessage(data.message || 'サーバーエラーが発生しました。');
      }
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message || '通信エラーが発生しました。'
      );
    }
  };

  return (
    <div className={styles["login-wrapper"]}>
      <h1>業務工数システム</h1>
      <h2>ログイン</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="numberInput">従業員番号</label>
          <input
            type="number"
            id="numberInput"
            value={employee_no}
            onChange={(e) => {
              const value = e.target.value;
              setNumber(value === '' ? '' : value);
            }}
            required
          />
        </div>
        {errorMessage && (
          <div role="alert">{errorMessage}</div>
        )}
        <button type="submit" className="blue_button">ログイン</button>
      </form>
    </div>
  );
};

export default Login;