import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/DefinitionPage/DefDetailList.module.css";

interface DetailData {
  id: number;
  def_symbol: string;
  def_select: string;
}

const DefDeteDetailList: React.FC = () => {
  const [data, setData] = useState<DetailData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSymbol, setSearchSymbol] = useState<string>(""); // 選択された値
  const [currentFilterSymbol, setCurrentFilterSymbol] = useState<string>(""); // 検索確定用
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [allSymbols, setAllSymbols] = useState<string[]>([]); // 選択肢用
  const navigate = useNavigate();

  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/api/def_detail_list/`,
        {
          params: { 
            page: currentPage,
            def_symbol: currentFilterSymbol 
          },
          withCredentials: true,
        }
      );

      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20;
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize));
      
      // バックエンドから送られてきた symbol_list をセット
      if (response.data.symbol_list) {
        setAllSymbols(response.data.symbol_list);
      }
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
  }, [currentPage, navigate, currentFilterSymbol]);

  useEffect(() => {
    fetchData();
  }, [currentPage, fetchData]);

  const handleSearch = () => {
    setCurrentFilterSymbol(searchSymbol);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["def-detail-list-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          作業詳細選択肢一覧
        </h1>

        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        <div 
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label>
            定義記号：
            <select
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              className={styles["search-select"]}
            >
              <option value="">すべて</option>
              {allSymbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>
          <button onClick={handleSearch} className="green_button">
            検索
          </button>
        </div>

        <div className={styles["table-wrapper"]}>
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
                    <th className={styles["th-collar"]}>定義記号</th>
                    <th className={styles["th-collar"]}>作業詳細</th>
                    <th className={styles["th-collar"]}>編集</th>
                    <th className={styles["th-collar"]}>削除</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.def_symbol}</td>
                      <td>{item.def_select}</td>
                      <td>
                        <Link
                          to={`/def-detail-update/${item.id}`}
                          className={styles["a-collar"]}
                        >
                          編集
                        </Link>
                      </td>
                      <td>
                        <Link
                          to={`/def-detail-delete/${item.id}`}
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
                buttonColor="#0f0"
                hoverColor="#32cd32"
              />
            </TableContainer>
          )}
        </div>
      </div>
    </>
  );
};

export default DefDeteDetailList;