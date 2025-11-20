import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/InquirPage/InquirDetail.module.css";

// 型定義
interface Inquir {
  employee_no2: number;
  name: string;
  content_choice: string;
  inquiry: string;
  answer: string;
}

// メンバー情報の型定義
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
  break_check: boolean;
  def_prediction: boolean;
}

// APIからのレスポンスデータの型定義
interface Response {
  inquir_data: Inquir; // 工数データ本体
  login_data: Member; // メンバー情報
  inquir_member_data: Member; // 質問者のメンバー情報
}

// KosuEditコンポーネントの定義
const InquirDetail: React.FC = () => {
  const navigate = useNavigate(); // 画面遷移のためのフック
  const [formData, setFormData] = useState<Inquir | null>(null); // 編集対象
  const [loading, setLoading] = useState<boolean>(true); // ローディング状態
  const [error, setError] = useState<string | null>(null); // フェッチ時のエラーメッセージ
  const { id } = useParams<{ id: string }>(); // URLパラメータから工数データのIDを取得
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブル最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブル幅
  const [memberData, setMemberData] = useState<Member | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // データ取得のためのuseEffect
  useEffect(() => {
    // APIエンドポイントにGETリクエストを送信し、工数データと関連データを取得
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_detail/${id}/`, { withCredentials: true })
      .then((response) => {
        const { inquir_data } = response.data;
        setFormData(inquir_data); // フォームデータをセット
        const login_data = response.data.login_data;
        setMemberData(login_data);
        setLoading(false); // ローディング終了
      })
      .catch((err) => {
        console.error("APIエラー:", err);
        // 認証エラー (401) の場合はログイン画面へ遷移
        if (err.response?.status === 401) {
          navigate("/login");
        } else {
          setError(err.message); // その他のエラーをセット
        }
        setLoading(false); // ローディング終了
      });
  }, [id, navigate]); // 依存配列: idとnavigateが変更されたときのみ実行

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
  }, []);

  // ローディング中またはエラー、データがない場合の表示
  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  // レンダリング
  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["inquir-detail-wrapper"]}>
        <h1 className={styles["h1-collar"]}>問い合わせ詳細</h1>
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-list">問い合わせ履歴</Link>
        </nav>

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
                <th className={styles["th-collar"]}>
                  問い合わせ者
                </th>
                <td>
                  {formData ? formData.employee_no2 : ""}：{memberData ? memberData.name : ""}
                </td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>
                  内容
                </th>
                <td>
                  {formData ? formData.content_choice : ""}
                </td>
              </tr>
            </thead>
          </table>
        </div>


      </div>
    </>
  );
};

export default InquirDetail;