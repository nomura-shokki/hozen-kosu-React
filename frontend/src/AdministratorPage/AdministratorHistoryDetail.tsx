import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../components/Loading";
import styles from "../styles/AdministratorPage/AdministratorHistoryDetail.module.css";

interface History {
  id: number;
  operation: string;
  table_name: string;
  record_id: string;
  login_No: string;
  changes: string; // changesはstring型として維持
  timestamp: string;
}

interface Response {
  history_data: History;
}

// 変更内容のオブジェクトの型定義（changesの内容に応じて）
interface ChangesObject {
  [key: string]: any; // old/new構造、または単一の値が入る可能性を許容
}

const HistoryDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<History | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    axios
      .get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_history_detail/${id}/`, { withCredentials: true })
      .then((response) => {
        const { history_data } = response.data;
        setFormData(history_data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [id, navigate]);

  useEffect(() => {
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight);
    };

    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateMaxHeight();
    updateTableWidth();

    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [formData]);

  if (loading) {
    return <div><Loading isLoading={loading} /></div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!formData) {
    return <div>データが見つかりません</div>;
  }

  const handleDelete = () => {
    const confirmed = window.confirm("削除しますか？");
    if (!confirmed) {
      return;
    }

    axios
      .delete(`${process.env.REACT_APP_API_BASE_URL}/api/manager_history_detail/${id}/`, { withCredentials: true })
      .then(() => {
        alert("削除が完了しました");
        navigate("/manager-history");
      })
      .catch((error) => {
        console.error(error);
        alert("削除時にエラーが発生しました");
      });
  };

  // changesをパースして表示用の要素に変換する処理（データ形式エラー対応済み）
  const renderChanges = (changesString: string) => {
    
    // ★ 修正箇所: changesがnullや空の場合のチェックを追加
    // TypeScriptの型安全性のために changesString as any を使用し、null/undefinedを処理
    if (!changesString || String(changesString).trim().length === 0) {
        return <div>変更なし</div>; // または return null;
    }
    
    // changesString が "null" という文字列である可能性も考慮し、
    // if (changesString === "null") { return <div>変更なし</div>; } のようなチェックも可能ですが、
    // 後のJSON置換処理で "None" => "null" に変換され、JSON.parseで null になるため、
    // ほとんどのケースは try-catch または上記の !changesString でカバーできます。

    try {
      // 1. Python/JavaScriptのオブジェクトリテラル形式をJSON形式に変換する処理

      // 1-a. 一重引用符で囲まれたプロパティ名（キー）を二重引用符に変換
      let validJsonString = changesString.replace(/'([^']+)':/g, '"$1":');

      // 1-b. Python形式の真偽値（True/False）をJSON形式（true/false）に変換
      validJsonString = validJsonString.replace(/True/g, 'true');
      validJsonString = validJsonString.replace(/False/g, 'false');
      
      // 1-c. Python形式のNoneをJSON形式（null）に変換
      validJsonString = validJsonString.replace(/None/g, 'null');
      
      // 1-d. 残っているすべての一重引用符を二重引用符に変換（値に含まれる一重引用符に対応）
      validJsonString = validJsonString.replace(/'/g, '"'); 

      // JSON文字列をパース
      const changes: ChangesObject = JSON.parse(validJsonString);
      
      // changesがパースの結果 null になった場合もここで処理（例えば changesStringが "null" という文字列だった場合）
      if (changes === null || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
          return <div>変更なし</div>;
      }

      const keys = Object.keys(changes);

      // 値を整形する関数
      const formatValue = (data: any) => {
        if (data === null) {
            return 'None';
        }
        if (typeof data === 'boolean') {
          return data ? 'True' : 'False';
        }
        return String(data);
      };

      // 各変更項目を改行して表示
      return (
        <>
          {keys.map((key) => {
            const value = changes[key];

            // 変更履歴の形式（{'old':..., 'new':...}）であるかチェック
            if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.old !== undefined && value.new !== undefined) {
                // 変更履歴形式の場合
                return (
                    <div key={key}>
                        {/* 変更箇所: whiteSpace: "pre-wrap" を "nowrap" に変更して、同項目での改行を防ぐ */}
                        <p style={{ margin: "0", whiteSpace: "nowrap" }}>
                            <strong style={{ fontWeight: "bold" }}>{key}</strong>
                            : &#123;'old': {formatValue(value.old)}, 'new': {formatValue(value.new)}&#125;
                        </p>
                    </div>
                );
            } else {
                // レコード全体など、単一の値の場合
                return (
                    <div key={key}>
                        {/* 変更箇所: whiteSpace: "pre-wrap" を "nowrap" に変更して、同項目での改行を防ぐ */}
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
      // JSONのパースに失敗した場合、エラーメッセージと元の文字列を表示
      console.error("Failed to parse changes JSON (after conversion attempts):", e);
      return <div><span style={{ color: 'red' }}>[パースエラー]</span> {changesString}</div>;
    }
  };

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
                <td>{formData.timestamp}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>操作種類</th>
                <td>{formData.operation}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>テーブル名</th>
                <td>{formData.table_name}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>レコードID</th>
                <td>{formData.record_id}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>従業員番号</th>
                <td>{formData.login_No}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>編集内容</th>
                {/* 修正後の renderChanges 関数を呼び出す */}
                <td>
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