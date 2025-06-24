import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ShopSelect from "../components/ShopSelect";
import "../styles/MemberPage/MemberList.css";

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
  const [searchNumber, setSearchNumber] = useState<string>(""); // 検索フォームの従業員番号
  const [searchShop, setSearchShop] = useState<string>(""); // 検索フォームのショップ名
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在のページ
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // max-height を動的に設定
  const navigate = useNavigate();

  // APIを呼び出してデータを取得
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/member_list/`, {
        params: {
          page: currentPage,
          employee_no: searchNumber,
          shop: searchShop,
        },
        withCredentials: true,
      });
  
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20; // バックエンドから表示件数を動的に取得
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize)); // ページ数を動的に計算
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
        } else {
          setError(err.message);
        }
      } else {
        setError("予期しないエラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };

  // max-height を計算する関数
  const updateMaxHeight = () => {
    const searchBarHeight = (document.querySelector(".search-bar") as HTMLElement)?.offsetHeight || 0; // 検索バーの高さを取得
    const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0; // h1要素の高さを取得
    setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40); // 40 は余白の調整値
  };

  useEffect(() => {
    updateMaxHeight(); // 初回に高さを計算
    window.addEventListener("resize", updateMaxHeight); // ウィンドウのリサイズ時に再計算
    return () => window.removeEventListener("resize", updateMaxHeight); // クリーンアップ
  }, []);

  // 現在のページが変わったときにデータを取得
  useEffect(() => {
    fetchData();
  }, [currentPage]); // currentPageが変更されるたびにAPIを呼び出す

  const handleSearch = () => {
    setCurrentPage(1); // 検索時には必ず最初のページに移動
    fetchData(); // データ取得
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1); // 次のページへ移動
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1); // 前のページへ移動
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1); // 最初のページへ移動
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages); // 最後のページへ移動
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>人員データ一覧</h1>

      <nav className="member-nav">
        <Link to="/member-menu">人員MENU</Link>
      </nav>

      <div className="search-bar">
        <div className="search-bar-row">
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
        </div>

        {/* 検索ボタン */}
        <div className="search-button-row">
          <button onClick={handleSearch}>検索</button>
        </div>
      </div>

      {data.length === 0 ? (
        <p>No data found.</p>
      ) : (
        <div className="table-wrapper" style={{ maxHeight: `${maxHeight}px`, overflowY: "auto" }}>
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
              {data.map((item) => (
                <tr key={item.employee_no}>
                  <td>{item.employee_no}</td>
                  <td>{item.name}</td>
                  <td>{item.shop}</td>
                  <td>{item.authority ? "有" : "無"}</td>
                  <td>{item.administrator ? "有" : "無"}</td>
                  <td>
                    <Link to={`/member-update/${item.employee_no}`}>編集</Link>
                  </td>
                  <td>
                    <Link to={`/member-delete/${item.employee_no}`}>削除</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ページネーター */}
          <div className="pagination">
            <button className="prev-button" disabled={currentPage === 1} onClick={handleFirstPage}>
              最初
            </button>
            <button className="prev-button" disabled={currentPage === 1} onClick={handlePreviousPage}>
              前
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button className="next-button" disabled={currentPage === totalPages} onClick={handleNextPage}>
              次
            </button>
            <button className="next-button" disabled={currentPage === totalPages} onClick={handleLastPage}>
              最後
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberList;