import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/AdministratorPage/AdministratorHistoryList.module.css";



// 操作履歴のレコード型定義
interface History {
  id: number;
  operation: string;   // 操作種別（作成、更新、削除など）
  table_name: string;  // 変更したテーブル名
  record_id: string;   // 対象レコードのID
  login_No: string;    // 操作者の従業員番号
  timestamp: string;     // 変更内容
  operator_name?: string; 
}

interface Member {
  id: number;
  employee_no: number;
  name: string;
}

// 日付フォーマット関数(タイムゾーン付のデータを「YYYY-MM-DD (HH:mm)」形式に変換)
const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    // 不正な日付ならそのまま返す
    if (isNaN(date.getTime())) return timestamp;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} (${hours}:${minutes})`;
  } catch (error) {
    // エラーハンドリング
    console.error("Failed to format timestamp:", error);
    return timestamp;
  }
};

// 操作履歴一覧
const AdministratorHistoryList: React.FC = () => {
  // フックの初期化
  const navigate = useNavigate(); // 画面遷移用関数設定

  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // 状態管理
  const [data, setData] = useState<History[]>([]); // 取得した履歴データのリスト
  const [loading, setLoading] = useState<boolean>(true); // ローディング状態
  const [error, setError] = useState<string | null>(null); // エラーメッセージ
  
  // フォームの値
  const [searchDay, setSearchDay] = useState<string>("");
  const [searchId, setSearchId] = useState<string>("");
  const [searchNo, setSearchNo] = useState<string>("");
  const [searchTable, setSearchTable] = useState<string>("");

  // APIに送るフィルタ条件(確定値)
  const [currentFilterDay, setCurrentFilterDay] = useState<string>("");
  const [currentFilterId, setCurrentFilterId] = useState<string>("");
  const [currentFilterNo, setCurrentFilterNo] = useState<string>("");
  const [currentFilterTable, setCurrentFilterTable] = useState<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false);

  // ページネーション管理
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);

  // テーブル名一覧
  const [modelChoices, setModelChoices] = useState<string[]>([]); 

  // データ取得
  const fetchData = useCallback(async (
    page: number,
    day: string,
    mode: boolean,
    id: string,
    table: string,
    loginNo: string,
  ) => {
    setLoading(true);
    try {
      const response = await api.get("/api/manager_history/", {
        params: {
          page: page,
          record_id: id,
          day: day,
          mode: mode ? "month" : "day", // trueなら月検索、falseなら日検索
          table_name: table,
          login_No: loginNo,
        }
      });

      const historyData = response.data?.history_data || {}; // 操作履歴
      const ModelChoices = response.data?.model_choices || {}; // テーブル名一覧

      // テーブル名一覧データが配列であることを確認
      if (Array.isArray(ModelChoices)) setModelChoices(ModelChoices);

      // ページネーション計算+データセット
      const results = historyData.results || [];
      const pageSize = historyData.page_size || 20;
      const memberOptions = response.data?.member_select || [];

      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: Member) => {
        memberNameMap[member.employee_no] = member.name;
      });

      const transformedData = results.map((item: History) => ({  
        ...item,  
        operator_name: memberNameMap[Number(item.login_No)] || `Unknown (${item.login_No})`,  
      }));

      setTotalPages(Math.ceil(historyData.count / pageSize));
      setData(transformedData);
    } catch (err) {
      // エラーハンドリング
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗に関わらずローディング終了
      setLoading(false);
    }
  }, [navigate]);

  // 検索値やページが変化したらデータ読み直し
  useEffect(() => {
    fetchData(currentPage, currentFilterDay, searchByMonth, currentFilterId, currentFilterTable, currentFilterNo);
  }, [currentPage, fetchData, currentFilterDay, currentFilterId, currentFilterNo, currentFilterTable, searchByMonth]);

  // 日付検索ハンドラ
  const handleDaySearchClick = (isMonthSearch: boolean) => {
    setCurrentFilterDay(searchDay); // 日付確定値としてセット
    setSearchByMonth(isMonthSearch); // モード（月/日）を更新
    setCurrentPage(1); // 検索時は1ページ目へ
  };

  // 絞り込みハンドラ
  const handleIDAndTableSearchClick = () => {
    setCurrentFilterDay(searchDay);
    setCurrentFilterId(searchId);
    setCurrentFilterNo(searchNo);
    setCurrentFilterTable(searchTable);
    setCurrentPage(1);
  };

  // 条件付きレンダリング
  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;

  // ページ表示
  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-history-wrapper"]}>
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          データ操作履歴一覧
        </h1>

        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <div className={styles["search-group"]}>
            <label htmlFor="searchDayInput">就業日:</label>
            <input
              type="date"
              id="searchDayInput"
              name="day"
              value={searchDay}
              onChange={(e) => setSearchDay(e.target.value)}
              placeholder="日付を選択"
            />
            <button onClick={() => handleDaySearchClick(true)} className="gray_button">
              指定月検索
            </button>
            <button onClick={() => handleDaySearchClick(false)} className="gray_button">
              指定日検索
            </button>
          </div>

          <div className={styles["search-group"]}>
            <input
              type="text"
              name="id"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="レコードID"
            />
            <select
              name="table"
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
            >
              <option value="">-- 操作テーブル選択 --</option>
              {modelChoices.map((table, index) => (
                <option key={index} value={table}>{table}</option>
              ))}
            </select>
            <input
              type="text"
              name="no"
              value={searchNo}
              onChange={(e) => setSearchNo(e.target.value)}
              placeholder="操作者従業員番号"
            />
            <button onClick={handleIDAndTableSearchClick} className="gray_button">
              検索
            </button>
          </div>
        </div>

        {data.length === 0 && !loading ? (
          <p>No data found.</p>
        ) : (
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
          >
            <table>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>データ操作日時</th>
                  <th className={styles["th-collar"]}>操作者No</th>
                  <th className={styles["th-collar"]}>操作者</th>
                  <th className={styles["th-collar"]}>操作テーブル</th>
                  <th className={styles["th-collar"]}>レコードID</th>
                  <th className={styles["th-collar"]}>操作種類</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTimestamp(item.timestamp)}</td>
                    <td>{item.login_No}</td>
                    <td>{item.operator_name}</td>
                    <td>{item.table_name}</td>
                    <td>{item.record_id}</td>
                    <td>{item.operation}</td>
                    <td>
                      <Link
                        to={`/manager-history-detail/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        詳細
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
              buttonColor="#656565"
              hoverColor="#3a3a3a"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};

export default AdministratorHistoryList;