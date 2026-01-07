import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import styles from "../styles/AdministratorPage/AdministratorHistoryDetail.module.css";



// 操作履歴のレコード型定義
interface History {
  id: number;
  operation: string;   // 操作種別（作成、更新、削除など）
  table_name: string;  // 変更したテーブル名
  record_id: string;   // 対象レコードのID
  login_No: string;    // 操作者の従業員番号
  changes: string;     // 変更内容
  timestamp: string;   // 操作日時
}

// APIレスポンス全体の型定義
interface Response {
  history_data: History;
}

// 変更内容をパースした後の動的オブジェクトの型定義
interface ChangesObject {
  [key: string]: any;
}

// 操作履歴
const HistoryDetail: React.FC = () => {
  // --- フックの初期化 ---
  const navigate = useNavigate(); // 画面遷移用関数設定
  const { id } = useParams<{ id: string }>(); // URLパラメータから履歴ID取得
  
  // 状態管理
  const [formData, setFormData] = useState<History | null>(null); // 取得した履歴データ
  const [loading, setLoading] = useState<boolean>(true); // ローディング状態
  const [error, setError] = useState<string | null>(null); // エラーメッセージ
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // テーブルの最大高さ
  const [tableWidth, setTableWidth] = useState<number>(0); // テーブルの動的な横幅
  
  // DOM参照
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 履歴詳細データを取得
        const response = await axios.get<Response>(
          `${process.env.REACT_APP_API_BASE_URL}/api/manager_history_detail/${id}/`, 
          { withCredentials: true } // セッション受け取り
        );
        const { history_data } = response.data;
        setFormData(history_data);
      } catch (err) {
        // エラーハンドリング
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.response?.data.message);
        } else {
          setError("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      } finally {
        // 成功・失敗に関わらずローディング終了
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    // windowサイズに合わせてテーブル高さ計算
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight);
    };

    // テーブルの実測幅を取得して親要素のスタイルに反映させる
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    // 初期テーブル測定実行
    updateMaxHeight();
    updateTableWidth();

    // リサイズ時再計算
    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    
    // クリーンアップ処理
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [formData]); // データ変更時にも再実行

  // 条件付きレンダリング
  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;
  if (!formData) return <div>データが見つかりません</div>;

  // 削除ハンドラ
  const handleDelete = async () => {
    const confirmed = window.confirm("削除しますか？");
    if (!confirmed) {
      return;
    }

    try {
      // レコード削除をリクエスト
      await axios.delete(
        `${process.env.REACT_APP_API_BASE_URL}/api/manager_history_detail/${id}/`, 
        { withCredentials: true }
      );
      alert("削除しました");
      navigate("/manager-history"); // 一覧画面へ戻る
    } catch (err) {
      // エラーハンドリング
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗に関わらずローディング終了
      setLoading(false);
    }
  };

  // 変更内容の表示整形
  // JSON/Python dict形式を、見やすいHTML要素に変換
  const renderChanges = (changesString: string) => {
    // 空データの場合
    if (!changesString || String(changesString).trim().length === 0) {
      return <div>変更なし</div>;
    }

    try {
      // Pythonの辞書形式リテラルをJSONとしてパースできるよう置換処理
      let validJsonString = changesString.replace(/'([^']+)':/g, '"$1":');
      validJsonString = validJsonString.replace(/True/g, 'true');
      validJsonString = validJsonString.replace(/False/g, 'false');
      validJsonString = validJsonString.replace(/None/g, 'null');
      validJsonString = validJsonString.replace(/'/g, '"');

      const changes: ChangesObject = JSON.parse(validJsonString);

      // パース結果が空などの場合
      if (changes === null || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
        return <div>変更なし</div>;
      }

      const keys = Object.keys(changes);

      // 値を表示用に整形する関数
      const formatValue = (data: any) => {
        if (data === null) return 'None';
        if (typeof data === 'boolean') return data ? 'True' : 'False';
        return String(data);
      };

      // 変更内容表示
      return (
        <>
          {keys.map((key) => {
            const value = changes[key];

            // 変更前と変更後の両方が含まれる構造の場合
            if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.old !== undefined && value.new !== undefined) {
              return (
                <div key={key}>
                  <p style={{ margin: "0", whiteSpace: "nowrap" }}>
                    <strong style={{ fontWeight: "bold" }}>{key}</strong>
                    : &#123;'old': {formatValue(value.old)}, 'new': {formatValue(value.new)}&#125;
                  </p>
                </div>
              );
            } else {
              // 単一の値のみの場合
              return (
                <div key={key}>
                  <p style={{ margin: "0", whiteSpace: "nowrap" }}>
                    <strong style={{ fontWeight: "bold" }}>{key}</strong>
                    : {formatValue(value)}
                  </p>
                </div>
              );
            }
          })}
        </>
      );
    } catch (e) {
      // JSONパースに失敗した場合、エラー表示と生の文字列表示
      console.error("Failed to parse changes JSON (after conversion attempts):", e);
      return <div><span style={{ color: 'red' }}>[パースエラー]</span> {changesString}</div>;
    }
  };

  // ページ表示
  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["admin-delete-wrapper"]}>
        <h1 className={styles["h1-collar"]}>データ操作履歴詳細</h1>
        
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-history">データ操作履歴一覧</Link>
        </nav>

        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          <table ref={tableRef}>
            <tbody>
              <tr>
                <th className={styles["th-collar"]}>操作日時</th>
                <td className={styles["td-position"]}>{formData.timestamp}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>操作種類</th>
                <td className={styles["td-position"]}>{formData.operation}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>テーブル名</th>
                <td className={styles["td-position"]}>{formData.table_name}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>レコードID</th>
                <td className={styles["td-position"]}>{formData.record_id}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>従業員番号</th>
                <td className={styles["td-position"]}>{formData.login_No}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>編集内容</th>
                <td className={styles["td-position"]}>
                  {renderChanges(formData.changes)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button onClick={handleDelete} className="gray_button">
          削除
        </button>
      </div>
    </>
  );
};

export default HistoryDetail;