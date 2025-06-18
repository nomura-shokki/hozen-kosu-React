import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

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

const MemberMenu: React.FC = () => {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Member[]>("http://localhost:8000/api/main_menu/", {
        withCredentials: true, // クッキーをリクエストに含める設定
      })
      .then((response) => {
        setData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          // ユーザーが未認証の場合はログイン画面にリダイレクト
          navigate("/login");
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [navigate]);

  const handleLogout = async () => {
    try {
      // Django セッションを削除するリクエスト送信
      await axios.post(
        "http://localhost:8000/api/logout/", // セッション削除用のバックエンドエンドポイント
        {},
        {
          withCredentials: true, // クッキーを送信する設定
        }
      );

      // React Router を使用して `/login` に遷移
      navigate("/login");
    } catch (error) {
      console.error("ログアウト中にエラーが発生しました。", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mt-4">
      <p>こんにちは {data.length > 0 ? data[0].name : ""}</p>
      <nav className="mb-4">
        <Link to="/member-menu" className="btn btn-primary me-2">人員MENU</Link>
      </nav>
      <button className="btn btn-danger" onClick={handleLogout}>
        ログアウト
      </button>
    </div>
  );
};

export default MemberMenu;