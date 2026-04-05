import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";
import ShopSelect from "../Components/ShopSelect";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/MemberPage/MemberList.module.css";

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

const MemberList: React.FC = () => {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchNumber, setSearchNumber] = useState<string>("");
  const [searchShop, setSearchShop] = useState<string>("");
  const [currentFilterNumber, setCurrentFilterNumber] = useState<string>("");
  const [currentFilterShop, setCurrentFilterShop] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const navigate = useNavigate();

  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(
        "/api/member_list/",
        {
          params: {
            page: currentPage,
            employee_no: currentFilterNumber,
            shop: currentFilterShop,
          }
        }
      );

      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else {
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, navigate, currentFilterNumber, currentFilterShop]);

  useEffect(() => {
    fetchData();
  }, [currentPage, fetchData]);

  const handleSearch = () => {
    setCurrentFilterNumber(searchNumber);
    setCurrentFilterShop(searchShop);

    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
    }
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["member-list-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          人員データ一覧
        </h1>

        <nav className={styles["member-nav"]}>
          <Link to="/member-menu">人員MENU</Link>
        </nav>

        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label>
            従業員番号：
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="従業員番号を入力"
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
          <button onClick={handleSearch} className="yellow_button">
            検索
          </button>
        </div>

        {data.length === 0 ? (
          <p>No data found.</p>
        ) : (
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
          >
            <table>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>従業員番号</th>
                  <th className={styles["th-collar"]}>氏名</th>
                  <th className={styles["th-collar"]}>ショップ</th>
                  <th className={styles["th-collar"]}>権限</th>
                  <th className={styles["th-collar"]}>管理者権限</th>
                  <th className={styles["th-collar"]}>編集</th>
                  <th className={styles["th-collar"]}>削除</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.employee_no}>
                    <td>{item.employee_no}</td>
                    <td>{item.name}</td>
                    <td>{item.shop}</td>
                    <td>{item.authority ? "有" : "無"}</td>
                    <td>{item.administrator ? "有" : "無"}</td>
                    <td>
                      <Link
                        to={`/member-update/${item.employee_no}`}
                        className={styles["a-collar"]}
                      >
                        編集
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/member-delete/${item.employee_no}`}
                        className={styles["a-collar"]}
                      >
                        削除
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              buttonColor="#ffd700"
              hoverColor="#ffa500"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};

export default MemberList;