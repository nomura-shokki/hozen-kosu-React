/**
 * ============================================================
 * ファイル名 : AdministratorTaskDetail.tsx
 * 種別       : 画面コンポーネント（非同期タスク詳細画面）
 * 概要       : 非同期タスク（バックアップ/復元などのバックグラウンド処理）1件の
 *              作成日時・状態・結果などを表示し、そのタスク記録を削除できる管理者向け画面。
 *
 * 主な機能   :
 *   - URLのIDに対応する非同期タスクデータの取得と表示
 *   - 非同期タスクデータの削除（確認ダイアログあり）
 *   - 画面の高さに合わせた表のスクロール表示
 *
 * 使用API    : GET    /api/manager_task_detail/<id>/  非同期タスク1件の取得
 *              DELETE /api/manager_task_detail/<id>/  非同期タスク1件の削除
 *              （いずれも kosu/views/main_views.py の AdministratorTaskDetail）
 * 画面URL    : /manager-task-detail/:id               （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorTaskDetail.module.css, Components/Loading.tsx,
 *              AdministratorPage/AdministratorTaskList.tsx（遷移元・削除後の遷移先）
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
import styles from "../styles/AdministratorPage/AdministratorTaskDetail.module.css";

// ============================================================
// 型定義
// ============================================================

/** 非同期タスク1件分のデータ（AsyncTask モデルの全項目） */
interface Task {
  id: number; // 非同期タスクデータのID（主キー）
  task_id: string; // タスクの識別子（バックアップ等の開始時にサーバーが UUID で発行）
  status: string; // 状態（"pending"=処理中 / "success"=成功 / "error"=失敗）
  result: string; // 処理結果（成功時は作成ファイルのパス等、失敗時はエラーメッセージ）
  created_at: string; // 作成日時（タスク登録時に自動設定）
  updated_at: string; // 最終更新日時（保存のたびに自動更新）
}

/** GET /api/manager_task_detail/<id>/ のレスポンス */
interface Response {
  task_data: Task; // 表示する非同期タスクデータ
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 非同期タスク詳細画面。
 *
 * URLの :id に対応する非同期タスクデータを取得し、縦並びの表で表示する。
 * 「削除」ボタンで確認のうえデータを削除し、非同期タスク一覧画面へ戻る。
 *
 * @returns 非同期タスク詳細画面のJSX
 */
const TaskDetail: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（表示する非同期タスクデータのID）
  const [formData, setFormData] = useState<Task | null>(null); // 表示する非同期タスクデータ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大高さ（px）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の外枠の幅（px）。表本体の幅に合わせる
  // 表の幅を測るために <table> のDOM要素を参照する（値の変化で再描画させる必要がないため ref）
  const tableRef = useRef<HTMLTableElement>(null);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時と URL の id が変わったとき: 非同期タスクデータを取得する
  useEffect(() => {
    /**
     * 非同期タスクデータ1件をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（結果は formData / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/manager_task_detail/<id>/ : 非同期タスクデータ1件を取得
        const response = await api.get<Response>(`/api/manager_task_detail/${id}/`);
        // レスポンスから task_data を取り出して表示用に保存
        const { task_data } = response.data;
        setFormData(task_data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: データなし など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, id]);

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
  }, [formData]);

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
   * 確認ダイアログで OK が押された場合のみ非同期タスクデータを削除し、
   * 完了メッセージを出して非同期タスク一覧画面へ戻る。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // 確認ダイアログでキャンセルされたら何もしない
    const confirmed = window.confirm("削除しますか？");
    if (!confirmed) return;
    // URLにIDがない場合は削除できないため何もしない
    if (!id) return;

    try {
      // DELETE /api/manager_task_detail/<id>/ : 非同期タスクデータ1件を削除
      await api.delete(`/api/manager_task_detail/${id}/`);
      alert("削除が完了しました");
      // 削除後は非同期タスク一覧画面へ戻る
      navigate("/manager-task");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404: データなし など）: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      // 読み込み中表示を終了する
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  return (
    <>
      {/* 読み込み中表示（この時点では loading は false のため表示されない） */}
      <Loading isLoading={loading} />
      <div className={styles["admin-delete-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>非同期タスク詳細</h1>
        {/* 非同期タスク一覧画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-task">非同期タスクデータ一覧</Link>
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
          {/* 非同期タスクの各項目を「見出し | 値」の縦並びで表示する表 */}
          <table ref={tableRef}>
            <tbody>
              {/* 作成日時 */}
              <tr>
                <th className={styles["th-collar"]}>作成日時</th>
                <td>{formData.created_at}</td>
              </tr>
              {/* 最終更新日時 */}
              <tr>
                <th className={styles["th-collar"]}>最終編集日時</th>
                <td>{formData.updated_at}</td>
              </tr>
              {/* タスクの識別子（UUID） */}
              <tr>
                <th className={styles["th-collar"]}>タスクID</th>
                <td>{formData.task_id}</td>
              </tr>
              {/* 状態（pending / success / error） */}
              <tr>
                <th className={styles["th-collar"]}>状態</th>
                <td>{formData.status}</td>
              </tr>
              {/* 処理結果 */}
              <tr>
                <th className={styles["th-collar"]}>結果</th>
                <td>{formData.result}</td>
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
export default TaskDetail;