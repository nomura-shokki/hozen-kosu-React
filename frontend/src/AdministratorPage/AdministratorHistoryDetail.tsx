/**
 * ============================================================
 * ファイル名 : AdministratorHistoryDetail.tsx
 * 種別       : 画面コンポーネント（データ操作履歴詳細画面）
 * 概要       : 操作履歴（データ変更の監査ログ）1件の操作日時・操作種類・対象テーブル・
 *              変更内容などを表示し、その履歴を削除できる管理者向け画面。
 *
 * 主な機能   :
 *   - URLのIDに対応する操作履歴データの取得と表示
 *   - 変更内容（項目名ごとの変更前/変更後の値）を読みやすい形に整形して表示
 *   - 操作履歴データの削除（確認ダイアログあり）
 *
 * 使用API    : GET    /api/manager_history_detail/<id>/  操作履歴1件の取得
 *              DELETE /api/manager_history_detail/<id>/  操作履歴1件の削除
 *              （いずれも kosu/views/main_views.py の AdministratorHistoryDetail）
 * 画面URL    : /manager-history-detail/:id               （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorHistoryDetail.module.css, Components/Loading.tsx,
 *              AdministratorPage/AdministratorHistoryList.tsx（遷移元・削除後の遷移先）,
 *              kosu/signals.py（操作履歴を記録する処理）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/AdministratorPage/AdministratorHistoryDetail.module.css";



// ============================================================
// 型定義
// ============================================================

/** 操作履歴1件分のデータ（History モデルの全項目） */
interface History {
  id: number; // 操作履歴データのID（主キー）
  operation: string;   // 操作種別（"CREATE"=新規作成 / "UPDATE"=更新 / "DELETE"=削除）
  table_name: string;  // 変更されたテーブル名（"member" / "Business_Time_graph"）
  record_id: string;   // 変更されたレコードのID
  login_No: string;    // 操作者の従業員番号（ログイン中の人員）
  changes: string;     // 変更内容（項目名と値の組。削除時は空）
  timestamp: string;   // 操作日時
}

/** GET /api/manager_history_detail/<id>/ のレスポンス */
interface Response {
  history_data: History; // 表示する操作履歴データ
}

/** 変更内容（changes）を解析した結果のオブジェクト。キーは項目名で、値の形は項目ごとに異なる */
interface ChangesObject {
  [key: string]: any; // 項目名 → 値（新規作成時は値そのもの / 更新時は { old, new }）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * データ操作履歴詳細画面。
 *
 * URLの :id に対応する操作履歴データを取得し、縦並びの表で表示する。
 * 「削除」ボタンで確認のうえデータを削除し、データ操作履歴一覧画面へ戻る。
 *
 * @returns データ操作履歴詳細画面のJSX
 */
const HistoryDetail: React.FC = () => {
  // ---------- フック初期化 ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（表示する操作履歴データのID）
  
  // ---------- state（画面の状態） ----------
  const [formData, setFormData] = useState<History | null>(null); // 表示する操作履歴データ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大高さ（px）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の外枠の幅（px）。表本体の幅に合わせる
  
  // 表の幅を測るために <table> のDOM要素を参照する（値の変化で再描画させる必要がないため ref）
  const tableRef = useRef<HTMLTableElement>(null);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時と URL の id が変わったとき: 操作履歴データを取得する
  useEffect(() => {
    /**
     * 操作履歴データ1件をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（結果は formData / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/manager_history_detail/<id>/ : 操作履歴データ1件を取得
        const response = await api.get<Response>(`/api/manager_history_detail/${id}/`);
        // レスポンスから history_data を取り出して表示用に保存
        const { history_data } = response.data;
        setFormData(history_data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: データなし など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        } else {
          // 通信以外の予期しないエラー
          setError("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // 表示データ（formData）が変わったとき: 表の外枠の高さと幅を計算し、
  // ウィンドウサイズ変更時にも計算し直すよう登録する
  useEffect(() => {
    /**
     * 表の外枠の最大高さを「ウィンドウの高さ − 見出し（h1）の高さ」に更新する。
     *
     * @returns なし（結果は maxHeight の state に反映）
     */
    const updateMaxHeight = () => {
      // 画面内の最初の h1 要素の高さ（見つからなければ 0）
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight);
    };

    /**
     * 表の外枠の幅を、表本体（<table>）の実際の幅に合わせる。
     *
     * @returns なし（結果は tableWidth の state に反映）
     */
    const updateTableWidth = () => {
      // 表が描画されている場合のみ幅を測る
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    // 表示直後に一度計算する
    updateMaxHeight();
    updateTableWidth();

    // ウィンドウサイズが変わるたびに計算し直す
    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    
    // 後片付け: 次の実行前・画面を離れるときに登録したイベントを解除する
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [formData]); // 表示データが変わると表の大きさも変わるため再計算する

  // ---------- 描画前のチェック ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // データが取得できなかった場合はメッセージだけを出す
  if (!formData) return <div>データが見つかりません</div>;

  // ---------- イベントハンドラ ----------

  /**
   * 「削除」ボタン押下時の処理。
   *
   * 確認ダイアログで OK が押された場合のみ操作履歴データを削除し、
   * 完了メッセージを出してデータ操作履歴一覧画面へ戻る。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // 確認ダイアログでキャンセルされたら何もしない
    const confirmed = window.confirm("削除しますか？");
    if (!confirmed) {
      return;
    }

    try {
      // DELETE /api/manager_history_detail/<id>/ : 操作履歴データ1件を削除
      await api.delete(`/api/manager_history_detail/${id}/`);
      alert("削除しました");
      navigate("/manager-history"); // 削除後はデータ操作履歴一覧画面へ戻る
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（403 / 404 など）: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  };

  // ---------- ヘルパー（表示整形） ----------

  /**
   * 変更内容（changes）の文字列を解析し、項目ごとに1行ずつ表示するJSXに変換する。
   *
   * changes は Python の辞書表記（例: {'name': {'old': '山田', 'new': '田中'}, 'authority': True}）の
   * 文字列で届く場合があるため、JSON として読めるよう記号や値を置き換えてから解析する。
   * 更新時の項目は「項目名: {'old': 変更前, 'new': 変更後}」、新規作成時の項目は「項目名: 値」の形で表示する。
   *
   * @param changesString - 操作履歴の変更内容（文字列）
   * @returns 変更内容を表示するJSX。空なら「変更なし」、解析失敗時は「[パースエラー]」と元の文字列
   */
  const renderChanges = (changesString: string) => {
    // 変更内容が空（削除の履歴など）の場合は「変更なし」と表示する
    if (!changesString || String(changesString).trim().length === 0) {
      return <div>変更なし</div>;
    }

    try {
      // Python の辞書表記を JSON 表記に置き換える
      //   1. 'キー': → "キー":  （例: 'name': → "name":）
      //   2. True / False / None → true / false / null
      //   3. 残りのシングルクォート ' → ダブルクォート "（文字列の値を囲む記号）
      let validJsonString = changesString.replace(/'([^']+)':/g, '"$1":');
      validJsonString = validJsonString.replace(/True/g, 'true');
      validJsonString = validJsonString.replace(/False/g, 'false');
      validJsonString = validJsonString.replace(/None/g, 'null');
      validJsonString = validJsonString.replace(/'/g, '"');

      // JSON として解析してオブジェクトにする（失敗すると catch へ進む）
      const changes: ChangesObject = JSON.parse(validJsonString);

      // 解析結果が null・配列・オブジェクト以外・キーなしの場合は「変更なし」と表示する
      if (changes === null || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
        return <div>変更なし</div>;
      }

      // 変更された項目名の一覧
      const keys = Object.keys(changes);

      /**
       * 値を表示用の文字列に変換する（Python と同じ表記に戻す）。
       *
       * @param data - 変換する値
       * @returns null → "None"、true/false → "True"/"False"、それ以外は文字列化した値
       */
      const formatValue = (data: any) => {
        if (data === null) return 'None';
        if (typeof data === 'boolean') return data ? 'True' : 'False';
        return String(data);
      };

      // 項目ごとに1行ずつ表示する（key には項目名を使う）
      return (
        <>
          {keys.map((key) => {
            const value = changes[key];

            // 更新時の項目: { old: 変更前, new: 変更後 } の形になっている場合
            if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.old !== undefined && value.new !== undefined) {
              // 「項目名（太字）: {'old': 変更前, 'new': 変更後}」を1行で表示（&#123; &#125; は { } の文字）
              return (
                <div key={key}>
                  <p style={{ margin: "0", whiteSpace: "nowrap" }}>
                    <strong style={{ fontWeight: "bold" }}>{key}</strong>
                    : &#123;'old': {formatValue(value.old)}, 'new': {formatValue(value.new)}&#125;
                  </p>
                </div>
              );
            } else {
              // 新規作成時の項目など、値が1つだけの場合: 「項目名（太字）: 値」を1行で表示
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
      // JSON として解析できなかった場合: エラー表示を付けて元の文字列をそのまま表示する
      console.error("Failed to parse changes JSON (after conversion attempts):", e);
      return <div><span style={{ color: 'red' }}>[パースエラー]</span> {changesString}</div>;
    }
  };

  // ---------- 描画（JSX） ----------

  return (
    <>
      {/* 読み込み中表示（この時点では loading は false のため表示されない） */}
      <Loading isLoading={loading} />
      <div className={styles["admin-delete-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>データ操作履歴詳細</h1>
        
        {/* データ操作履歴一覧画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-history">データ操作履歴一覧</Link>
        </nav>

        {/* 表の外枠: 高さが maxHeight を超えたら縦スクロール、幅は表本体に合わせる */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          {/* 操作履歴の各項目を「見出し | 値」の縦並びで表示する表 */}
          <table ref={tableRef}>
            <tbody>
              {/* 操作日時 */}
              <tr>
                <th className={styles["th-collar"]}>操作日時</th>
                <td className={styles["td-position"]}>{formData.timestamp}</td>
              </tr>
              {/* 操作種類（CREATE / UPDATE / DELETE） */}
              <tr>
                <th className={styles["th-collar"]}>操作種類</th>
                <td className={styles["td-position"]}>{formData.operation}</td>
              </tr>
              {/* 変更されたテーブル名 */}
              <tr>
                <th className={styles["th-collar"]}>テーブル名</th>
                <td className={styles["td-position"]}>{formData.table_name}</td>
              </tr>
              {/* 変更されたレコードのID */}
              <tr>
                <th className={styles["th-collar"]}>レコードID</th>
                <td className={styles["td-position"]}>{formData.record_id}</td>
              </tr>
              {/* 操作者の従業員番号 */}
              <tr>
                <th className={styles["th-collar"]}>従業員番号</th>
                <td className={styles["td-position"]}>{formData.login_No}</td>
              </tr>
              {/* 変更内容（renderChanges で項目ごとに整形して表示） */}
              <tr>
                <th className={styles["th-collar"]}>編集内容</th>
                <td className={styles["td-position"]}>
                  {renderChanges(formData.changes)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 削除ボタン（押すと確認ダイアログを出してから削除する） */}
        <button onClick={handleDelete} className="gray_button">
          削除
        </button>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default HistoryDetail;