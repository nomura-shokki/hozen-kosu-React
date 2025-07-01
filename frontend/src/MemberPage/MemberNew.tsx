// Reactの基本フックや型定義をインポート
import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios'; // HTTPクライアント
import ShopSelect from '../components/ShopSelect'; // ショップ選択コンポーネント
import { Link, useNavigate } from 'react-router-dom'; // 画面遷移に使用
import styles from "../styles/MemberPage/MemberNew.module.css"; // CSSモジュール

// フォームで取り扱うデータ型を定義
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
  // 初期フォーム値と状態管理
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

  // エラーメッセージ表示用の状態
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ページ遷移用のフック
  const navigate = useNavigate();

  // 初回マウント時、ログインチェック（セッション確認）
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/member_new/`, { withCredentials: true })
      .catch((err) => {
        // 未認証や権限不足の場合のリダイレクト処理
        if (err.response?.status === 401) {
          navigate('/login');
        } else if (err.response?.status === 403) {
          navigate('/');
        } else {
          console.error('不明なエラー:', err);
        }
      });
  }, [navigate]);

  // 入力項目が変更されたときの処理
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    if (type === 'checkbox') {
      // チェックボックスのときは checked を利用
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      // テキストやセレクトボックスなどは value を反映
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // フォーム送信時の処理
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null); // エラーリセット

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/member_new/`, formData, { withCredentials: true })
      .then((response) => {
        alert('登録完了！');

        // フォームをリセット
        setFormData({
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
      })
      .catch((error) => {
        console.error(error);
        // サーバーが返すエラーメッセージを表示
        if (error.response && error.response.data) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage('不明なエラーが発生しました。IT担当者に連絡してください。');
        }
      });
  };

  // JSXによるUI描画
  return (
    <div className={styles["member-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>人員登録</h1>
      <nav className={styles["member-nav"]}>
        <Link to="/member-menu">人員MENU</Link>
      </nav>

      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles["search-bar"]}>
          <div className={styles["search-bar-row"]}>
            <label htmlFor="employee_no">従業員番号:</label>
            <input
              type="number"
              id="employee_no"
              name="employee_no"
              value={formData.employee_no}
              onChange={handleChange}
            />

            <label htmlFor="name">氏名:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />

            <label htmlFor="shop">ショップ:</label>
            <ShopSelect
              name="shop"
              value={formData.shop}
              onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
            />

            <div className={styles["switch-wrapper"]}>
              <label htmlFor="authority">権限:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="authority"
                  name="authority"
                  checked={formData.authority}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            <div className={styles["switch-wrapper"]}>
              <label htmlFor="administrator">管理者権限:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="administrator"
                  name="administrator"
                  checked={formData.administrator}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
          </div>
          <button type="submit" className="yellow_button">登録</button>
        </div>
      </form>
    </div>
  );
};

export default MemberNew;
