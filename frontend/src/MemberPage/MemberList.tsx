import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ShopSelect from '../components/ShopSelect';
import "../styles/MemberList.css";

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
  id: string;
}

const MemberList: React.FC = () => {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchNumber, setSearchNumber] = useState<string>('');
  const [searchShop, setSearchShop] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Member[]>(`${process.env.REACT_APP_API_BASE_URL}/api/member_list/`, {
        withCredentials: true,
      })
      .then((response) => {
        setData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [navigate]);

  const filteredData = data.filter((member) => {
    const matchesNumber =
      searchNumber === '' || member.employee_no.toString().includes(searchNumber);
    const matchesShop =
      searchShop === '' || member.shop === searchShop;
    return matchesNumber && matchesShop;
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>人員データ一覧</h1>

      <nav>
        <Link to="/member-new">新規登録</Link>
        <Link to="/member-list">データ一覧</Link>
      </nav>

      <div className="search-bar">
        <label>
          従業員番号：
          <input
            type="text"
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            placeholder="12345"
          />
        </label>
        <label>
          ショップ：
          <ShopSelect
            name="shopFilter"
            value={searchShop}
            onChange={(e) => setSearchShop(e.target.value)}
          />
        </label>
      </div>

      {filteredData.length === 0 ? (
        <p>No data found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>従業員番号</th>
              <th>氏名</th>
              <th>ショップ</th>
              <th>権限</th>
              <th>管理者権限</th>
              <th>編集</th>
              <th>削除</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.employee_no}>
                <td>{item.employee_no}</td>
                <td>{item.name}</td>
                <td>{item.shop}</td>
                <td>{item.authority ? "有" : "無"}</td>
                <td>{item.administrator ? "有" : "無"}</td>
                <td><Link to={`/member-updata/${item.employee_no}`}>編集</Link></td>
                <td><Link to={`/member-delete/${item.employee_no}`}>削除</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MemberList;