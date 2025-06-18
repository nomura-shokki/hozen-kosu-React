import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';

const Login: React.FC = () => {
  const [employee_no, setNumber] = useState<string>(''); // useStateを文字列として管理
  const [errorMessage, setErrorMessage] = useState<string>('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(''); // エラーメッセージをリセット

    try {
      const response = await axios.post(
        'http://localhost:8000/api/login/', // リクエストURL
        { employee_no: Number(employee_no) }, // リクエストボディを数値型に変換して送信
        {
          headers: {
            'Content-Type': 'application/json', // 必要なヘッダー
          },
          withCredentials: true, // **クッキーを送信する設定**
        }
      );

      const data = response.data;

      if (data.status === 'success') {
        navigate('/'); // メインMENUに移動
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
    <div>
      <h1>業務工数システム</h1>
      <h2>ログイン</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="numberInput">
            従業員番号
          </label>
          <input
            type="number"
            id="numberInput"
            value={employee_no}
            onChange={(e) => {
              const value = e.target.value;
              // 入力が空の場合、空文字列を許可する
              if (value === '') {
                setNumber('');
              } else {
                setNumber(value);
              }
            }}
            required
          />
        </div>
        {errorMessage && (
          <div role="alert">
            {errorMessage}
          </div>
        )}
        <button type="submit">
          ログイン
        </button>
      </form>
    </div>
  );
};

export default Login;