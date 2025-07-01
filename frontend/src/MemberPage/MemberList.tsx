import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ShopSelect from "../components/ShopSelect";
import styles from "../styles/MemberPage/MemberList.module.css";

// Member データ型の定義
interface Member {
  employee_no: number; // 従業員番号
  name: string;        // 氏名
  shop: string;        // ショップ名
  authority: boolean;  // 権限の有無
  administrator: boolean; // 管理者権限の有無
}

// Reactコンポーネントの定義
const MemberList: React.FC = () => {
  // Reactの状態管理フックを使用して必要な状態を定義
  const [data, setData] = useState<Member[]>([]); // Memberデータ一覧
  const [loading, setLoading] = useState<boolean>(true); // データ取得中フラグ
  const [error, setError] = useState<string | null>(null); // エラー情報
  const [searchNumber, setSearchNumber] = useState<string>(""); // 検索条件: 従業員番号
  const [searchShop, setSearchShop] = useState<string>(""); // 検索条件: ショップ名
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在のページ番号
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 動的にテーブルの最大高さを設定
  const [tableWidth, setTableWidth] = useState<number>(0); // table の横幅を保存
  const tableRef = useRef<HTMLTableElement>(null); // table 要素への参照
  const navigate = useNavigate(); // ルーティング用のナビゲーション関数

  // データをAPIから取得する関数
  const fetchData = async () => {
    setLoading(true); // データ取得開始時にローディング状態を設定
    try {
      // APIを呼び出し、検索条件と現在のページをパラメーターとして渡す
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/member_list/`, {
        params: {
          page: currentPage,
          employee_no: searchNumber,
          shop: searchShop,
        },
        withCredentials: true, // クッキーを含むリクエストを送信
      });

      // レスポンスからデータを抽出して状態を更新
      const results = response.data.results || [];
      const pageSize = response.data.page_size || 20; // 1ページあたりの件数（デフォルトは20）
      setData(results);
      setTotalPages(Math.ceil(response.data.count / pageSize)); // 総ページ数を計算
    } catch (err) {
      // エラー時の処理を追加
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          // 認証が必要な場合、ログイン画面へ遷移
          navigate("/login");
        } else if (err.response?.status === 403) {
          // 権限エラーが発生した場合、ホーム画面へ遷移
          navigate('/');
        } else {
          setError(err.message); // その他のAxiosエラーを表示
        }
      } else {
        setError("予期しないエラーが発生しました"); // 未知のエラー
      }
    } finally {
      setLoading(false); // データ取得終了時にローディング状態解除
    }
  };

  // 動的な高さを計算して更新する関数
  useEffect(() => {
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(".search-bar") as HTMLElement)?.offsetHeight || 0; // 検索バーの高さ
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0; // h1タグの高さ
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40); // 残りの高さを計算して更新
    };

    updateMaxHeight(); // 初回に高さを計算
    window.addEventListener("resize", updateMaxHeight); // ウィンドウサイズ変更時に再計算
    return () => window.removeEventListener("resize", updateMaxHeight); // コンポーネントアンマウント時にイベント解除
  }, []);

  // table 要素の横幅を計算して更新する関数
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth); // table の横幅を取得して状態を更新
      }
    };

    updateTableWidth(); // 初回に横幅を計算
    window.addEventListener("resize", updateTableWidth); // ウィンドウサイズ変更時に再計算
    return () => window.removeEventListener("resize", updateTableWidth); // コンポーネントアンマウント時にイベント解除
  }, [data]); // データが変更されたときにも計算を再実行

  // ページが変更されたときのデータ取得処理
  useEffect(() => {
    fetchData();
  }, [currentPage]); // ページ番号が変更されるたびに再取得

  // 検索ボタンがクリックされたときの処理
  const handleSearch = () => {
    setCurrentPage(1); // 検索時には1ページ目に戻す
    fetchData(); // APIからのデータを再取得
  };

  // ページ遷移ボタンの処理を定義
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1); // 次のページへ進む
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1); // 前のページへ戻る
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1); // 最初のページへ移動
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages); // 最後のページへ移動
  };

  // ローディング状態の表示
  if (loading) return <div>Loading...</div>;
  // エラー状態の表示
  if (error) return <div>Error: {error}</div>;

  // メインのJSX出力
  return (
    <div className={styles["member-list-wrapper"]}>
      <h1 className={styles["h1-collar"]}>人員データ一覧</h1>

      <nav className={styles["member-nav"]}>
        <Link to="/member-menu">人員MENU</Link>
      </nav>

      <div className={styles["search-bar"]}>
        <div className={styles["search-bar-row"]}>
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

        <div className={styles["search-button-row"]}>
          <button onClick={handleSearch} className="yellow_button">検索</button>
        </div>
      </div>

      {data.length === 0 ? (
        <p>No data found.</p>
      ) : (
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            width: `${tableWidth + 5}px`, // table横幅 + 5px を適用
          }}
        >
          <table ref={tableRef}>
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
                    <Link to={`/member-update/${item.employee_no}`} className={styles["a-collar"]}>編集</Link>
                  </td>
                  <td>
                    <Link to={`/member-delete/${item.employee_no}`} className={styles["a-collar"]}>削除</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles["pagination"]}>
            <button className={styles["prev-button"]} disabled={currentPage === 1} onClick={handleFirstPage}>
              最初
            </button>
            <button className={styles["prev-button"]} disabled={currentPage === 1} onClick={handlePreviousPage}>
              前
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button className={styles["next-button"]} disabled={currentPage === totalPages} onClick={handleNextPage}>
              次
            </button>
            <button className={styles["next-button"]} disabled={currentPage === totalPages} onClick={handleLastPage}>
              最後
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberList;