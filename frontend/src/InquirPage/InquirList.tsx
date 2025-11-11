import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import ItemSelect from "../components/ItemSelect";
import TeamMemberSelect from "../components/TeamMemberSelect";
import styles from "../styles/InquirPage/InquirList.module.css";

// 型定義
interface Inquir {
  id: number;
  employee_no2: number;
  name: string;
  content_choice: string;
  inquiry: string;
  answer: string;
}

interface InquirMember {
  id: number;
  employee_no: number;
  name: string;
}

const TeamList: React.FC = () => {
  // 状態管理フック
  const [data, setData] = useState<Inquir[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // データ読み込み中の状態
  const [error, setError] = useState<string | null>(null); // エラーメッセージ
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在ページ
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブル最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブル幅
  const [MemberOptions, setMemberOptions] = useState<InquirMember[]>([]); // 班員選択プルダウン選択肢
  const [searchItemInput, setSearchItemInput] = useState<string>("");
  const [searchItem, setSearchItem] = useState<string>("");
  const [selectedMemberInput, setSelectedMemberInput] = useState<string>(""); // 選択メンバー従業員番号 (入力値)
  const [searchMemberId, setSearchMemberId] = useState<string>(""); // 検索用メンバー従業員番号 (確定値)

  // DOM要素への参照フック
  const tableRef = useRef<HTMLTableElement>(null); // テーブル要素参照

  // --- ルーティングのためのフック ---
  const location = useLocation();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // APIエンドポイントにGETリクエストを送信
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_list/`, {
        params: {
          page: currentPage,
          ...(searchMemberId && {
            member_id: searchMemberId,
          }),
          ...(searchItem && {
            item: searchItem,
          }),
        },
        withCredentials: true,
      });

      // レスポンスからデータとページネーション情報を取得
      console.log("API Response:", response.data); // デバッグ用ログ
      const paginationData = response.data?.inquir_data || {};
      const results = paginationData.results || [];
      const pageSize = response.data.page_size || 20;
      const memberOptions = response.data?.member_data || [];

      // 1. メンバーIDを名前に変換するためのマップを作成
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: InquirMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 2. 取得したデータ（results）のnameを従業員番号から名前に変換
      const transformedData = results.map((item: Inquir) => ({
        ...item,
        // item.employee_no3をキーとしてmemberNameMapから名前を取得
        name: memberNameMap[item.employee_no2] || `Unknown (${item.employee_no2})`,
      }));

      // 状態を更新
      setData(transformedData); // 現在表示するデータ
      setMemberOptions(memberOptions); // メンバー選択肢
      setTotalPages(Math.ceil(paginationData.count / pageSize)); // 総ページ数を計算
    } catch (err) {
      // エラーハンドリング
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          // 認証エラー（トークン切れなど）の場合はログインページへ遷移
          navigate("/login");
        } else if (err.response?.status === 403) {
          // 権限エラーの場合はトップページへ遷移
          navigate("/");
        } else {
          // その他のAPIエラー
          setError(err.message);
        }
      } else {
        // Axios以外の予期せぬエラー
        console.error("予期しないエラー:", err);
        setError("予期しないエラーが発生しました");
      }
    } finally {
      // ローディング状態を解除
      setLoading(false);
    }
  }, [currentPage, navigate, searchMemberId, searchItem]);

  // ルートが変更されたときに検索状態をリセット
  useEffect(() => {
    setCurrentPage(1);
    // ★修正ポイント5: 検索クエリの状態もリセット
    setSelectedMemberInput("");
    setSearchMemberId("");
    setSearchItemInput("");
    setSearchItem("");
  }, [location.pathname]);

  // `fetchData`が変更されたときにデータを取得
  useEffect(() => {
    fetchData();
    // `fetchData`を依存配列に入れることで、`fetchData`が再生成される（=`currentPage`などが変わる）たびに実行されます。
  }, [fetchData]);

  // 画面リサイズ時にテーブルの最大高さを更新
  useEffect(() => {
    const updateMaxHeight = () => {
      // ヘッダーや検索バーの高さを取得し、画面の高さから引いてテーブルの最大高さを計算します。
      const searchBarHeight = (document.querySelector(`.${styles["search-bar"]}`) as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector(`.${styles["h1-collar"]}`) as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 120); // オフセット調整
    };

    updateMaxHeight();
    // リサイズイベントリスナーを追加
    window.addEventListener("resize", updateMaxHeight);
    // クリーンアップ関数を返し、コンポーネントがアンマウントされる際にイベントリスナーを削除します。
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // 画面リサイズ時にテーブルの幅を更新
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [data]);

  // 検索ボタンハンドラー
  const handleSearch = () => {
    const isMemberChanged = selectedMemberInput !== searchMemberId;
    const isItemChanged = searchItemInput !== searchItem;
    
    if (currentPage !== 1) {
      setCurrentPage(1); // ページ1にリセットし、useEffectでfetchDataが実行される
    } else if (isMemberChanged || isItemChanged) {
      setSearchMemberId(selectedMemberInput);
      setSearchItem(searchItemInput);
    }
  };

  // 次ページへの遷移
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // 前ページへの遷移
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // 最初のページへの遷移
  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  // 最後のページへの遷移
  const handleLastPage = () => {
    setCurrentPage(totalPages);
  };

  // 人員選択プルダウン変更ハンドラー
  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMemberInput(event.target.value);
  };

  // エラーが発生した場合
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["inquir-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>問い合わせ履歴</h1>
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-menu">問い合わせMENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <label htmlFor="team-member-select">質問者</label>
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMemberInput}
            onChange={handleMemberChange}
            options={MemberOptions}
          />
          <label htmlFor="ItemSelect">内容</label>
          <ItemSelect
            id="ItemSelect"
            name="ItemSelect"
            value={searchItemInput}
            onChange={(e) => setSearchItemInput(e.target.value)}
          />
          <button onClick={handleSearch} className="pink_button">検索</button>
        </div>
        {data.length === 0 && !loading ? (
          <p>No data found.</p>
        ) : (
          <div
            className={styles["table-wrapper"]}
            style={{
              maxHeight: `${maxHeight}px`,
              overflowY: "auto",
              width: tableWidth > 0 ? `${tableWidth + 20}px` : "100%", 
            }}
          >
            <table ref={tableRef}>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>問い合わせ者</th>
                  <th className={styles["th-collar"]}>内容</th>
                  <th className={styles["th-collar"]}>問い合わせ</th>
                  <th className={styles["th-collar"]}>回答</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.content_choice}</td>
                    <td>{item.inquiry.length > 3 ? item.inquiry.substring(0, 3) + "..." : item.inquiry}</td>
                    <td>{item.answer.length > 3 ? item.answer.substring(0, 3) + "..." : item.answer}</td>
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
    </>
  );
};

export default TeamList;