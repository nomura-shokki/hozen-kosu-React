import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import TeamMemberSelect from "../components/TeamMemberSelect";
import styles from "../styles/TeamPage/TeamList.module.css";

// 工数データ型定義
interface Kosu {
  id: number;
  employee_no3: number;
  name: string;
  work_day2: string;
  tyoku2: string;
  judgement: boolean;
}

// 班員メンバー選択プルダウン型定義
interface TeamMember {
  id: number;
  employee_no: number;
  name: string;
}

// 直データを日本語変換
const formatTyoku = (value: string | number): string => {
  switch (Number(value)) {
    case 1: return "1直";
    case 2: return "2直";
    case 3: return "3直";
    case 4: return "常昼";
    case 5: return "連1直";
    case 6: return "連2直";
    default: return "";
  }
};

// 日付から曜日取得
const getDayOfWeek = (dateStr: string): string => {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr);
  return days[date.getDay()] || "";
};

const TeamList: React.FC = () => {
  // 状態管理フック
  const [data, setData] = useState<Kosu[]>([]); // 表示する工数データ
  const [originalData, setOriginalData] = useState<Kosu[]>([]); // フィルタリング前の全工数データ（メンバー選択フィルタリング用）
  const [loading, setLoading] = useState<boolean>(true); // データ読み込み中の状態
  const [error, setError] = useState<string | null>(null); // エラーメッセージ
  const [searchDay, setSearchDay] = useState<string>(""); // 日付入力値
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false); // 月検索フラグ
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在ページ
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブル最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブル幅
  const [teamMemberOptions, setTeamMemberOptions] = useState<TeamMember[]>([]); // 班員選択プルダウン選択肢
  const [selectedMember, setSelectedMember] = useState<string>(""); // 選択メンバー従業員番号

  // DOM要素への参照フック
  const tableRef = useRef<HTMLTableElement>(null); // テーブル要素参照
  const dateInputRef = useRef<HTMLInputElement>(null); // 日付入力参照

  // --- ルーティングのためのフック ---
  const location = useLocation();
  const navigate = useNavigate();

  // --- APIからデータを取得するための関数 ---
  // `useCallback`を使って、`currentPage`, `Maps`, `searchByMonth`, `searchDay`が変わったときにのみ関数を再生成します。
  // これにより、不要な再レンダリングを防ぎ、パフォーマンスを向上させます。
  const fetchData = useCallback(async (targetMode: boolean | null = null) => {
    setLoading(true);
    try {
      // APIエンドポイントにGETリクエストを送信
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/team_list/`, {
        params: {
          page: currentPage,
          // `searchDay`が存在する場合、検索関連のパラメータを追加します。
          // `...()`は、条件付きでオブジェクトのプロパティを追加するJavaScriptの記法です。
          ...(searchDay && {
            day: searchDay,
            mode: targetMode !== null ? (targetMode ? "month" : "day") : (searchByMonth ? "month" : "day"),
            filter: "true",
          }),
        },
        withCredentials: true, // クッキーを送信するために必要
      });

      // レスポンスからデータとページネーション情報を取得
      const paginationData = response.data?.pagination_data || {};
      const results = paginationData.results || [];
      const pageSize = response.data.page_size || 20;
      const memberOptions = response.data?.team_member_select || [];

      // 1. メンバーIDを名前に変換するためのマップを作成
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: TeamMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 2. 取得したデータ（results）のnameを従業員番号から名前に変換
      const transformedData = results.map((item: Kosu) => ({
        ...item,
        // item.employee_no3をキーとしてmemberNameMapから名前を取得
        name: memberNameMap[item.employee_no3] || `Unknown (${item.employee_no3})`,
      }));

      // 状態を更新
      setData(transformedData); // 現在表示するデータ
      setOriginalData(transformedData); // フィルタリング前の元データ
      setTeamMemberOptions(memberOptions); // メンバー選択肢
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
  }, [currentPage, navigate, searchByMonth, searchDay]);

  // --- 副作用のためのuseEffectフック ---

  // ルートが変更されたときに検索状態をリセット
  useEffect(() => {
    setSearchDay("");
    setSearchByMonth(false);
    setCurrentPage(1);
    setSelectedMember("");
    // `location.pathname`を依存配列に入れることで、URLパスが変わるたびにこのエフェクトが実行されます。
  }, [location.pathname]);

  // `fetchData`が変更されたときにデータを取得
  useEffect(() => {
    fetchData();
    // `fetchData`を依存配列に入れることで、`fetchData`が再生成される（=`currentPage`などが変わる）たびに実行されます。
  }, [fetchData]);

  // 選択されたメンバーに応じてデータをフィルタリング
  useEffect(() => {
    if (selectedMember) {
      // `selectedMember`が選択されている場合、`originalData`から該当メンバーのデータのみを抽出
      const filteredData = originalData.filter(
        (item) => item.employee_no3.toString() === selectedMember
      );
      setData(filteredData);
    } else {
      // 選択されていない場合は、元の全データを表示
      setData(originalData);
    }
    // `selectedMember`または`originalData`が変わるたびに実行されます。
  }, [selectedMember, originalData]);

  // 画面リサイズ時にテーブルの最大高さを更新
  useEffect(() => {
    const updateMaxHeight = () => {
      // ヘッダーや検索バーの高さを取得し、画面の高さから引いてテーブルの最大高さを計算します。
      const searchBarHeight = (document.querySelector(".search-bar") as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40);
    };

    updateMaxHeight();
    // リサイズイベントリスナーを追加
    window.addEventListener("resize", updateMaxHeight);
    // クリーンアップ関数を返し、コンポーネントがアンマウントされる際にイベントリスナーを削除します。
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []); // 依存配列が空なので、コンポーネントのマウント時とアンマウント時にのみ実行されます。

  // 画面リサイズ時にテーブルの幅を更新
  useEffect(() => {
    const updateTableWidth = () => {
      // `tableRef.current`が存在する場合にテーブルの幅を取得します。
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [data]); // `data`が変わったときに実行され、テーブル幅を再計算します。

  // --- イベントハンドラー ---

  // 日付・月検索ボタンのクリックハンドラー
  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    fetchData(isMonthSearch);
    setCurrentPage(1); // 検索実行時は常に1ページ目に戻る
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

  // メンバー選択プルダウンの変更ハンドラー
  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMember(event.target.value);
  };

  // エラーが発生した場合の表示
  if (error) return <div>Error: {error}</div>;

  // コンポーネントレンダリング
  return (
    <>
      <Loading isLoading={loading} />
      {/* 全体をラップするコンテナ */}
      <div className={styles["team-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>班員工数履歴</h1>
        {/* ナビゲーションリンク */}
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <label htmlFor="search-day-input"></label>
          <input
            id="search-day-input"
            type="date"
            ref={dateInputRef}
            value={searchDay}
            onChange={(e) => setSearchDay(e.target.value)}
            placeholder="日付を選択"
          />
          {/* 検索ボタンのグループ */}
          <div className={styles["button-group"]}>
            <button
              onClick={() => handleSearch(true)}
              className="orange_button"
            >
              指定月
            </button>
            <button
              onClick={() => handleSearch(false)}
              className="orange_button"
            >
              指定日
            </button>
          </div>
        </div>
        {/* メンバー選択検索バー */}
        <div className={styles["search-bar"]}>
          <label htmlFor="team-member-select"></label>
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMember}
            onChange={handleMemberChange}
            options={teamMemberOptions}
          />
        </div>
        {/* データが存在しない場合のメッセージ */}
        {data.length === 0 ? (
          <p>No data found.</p>
        ) : (
          /* データが存在する場合のテーブル表示 */
          <div
            className={styles["table-wrapper"]}
            style={{
              maxHeight: `${maxHeight}px`,
              overflowY: "auto",
              width: `${tableWidth + 20}px`,
            }}
          >
            <table ref={tableRef}>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>班員</th>
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>
              <tbody>
                {/* `data`配列をマップして各行を生成 */}
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.work_day2} ({getDayOfWeek(item.work_day2)})</td>
                    <td>{formatTyoku(item.tyoku2)}</td>
                    <td className={item.judgement ? styles["status-ok"] : styles["status-ng"]}>
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    <td>
                      {/* 詳細ページへのリンク */}
                      <Link to={`/kosu-update/${item.id}`} className={styles["a-collar"]}>詳細</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* ページネーションコントロール */}
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