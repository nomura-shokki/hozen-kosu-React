/**
 * ============================================================
 * ファイル名 : MemberDelete.tsx
 * 種別       : 画面コンポーネント（人員削除画面）
 * 概要       : 登録済みの人員（従業員）1人分のデータを表示し、確認のうえ削除する画面。
 *              権限ありの人員のみ利用できる。
 *
 * 主な機能   :
 *   - URLの従業員番号に対応する人員データを取得して表で表示
 *   - 「削除」ボタンで確認ダイアログを出し、OKなら削除して人員一覧へ戻る
 *   - 表の高さ・幅を画面サイズと表の中身に合わせて調整
 *
 * 使用API    : GET    /api/member_update/<従業員番号>/  人員データ1件の取得
 *                                                       （kosu/views/member_views.py の MemberUpdate）
 *              DELETE /api/member_delete/<従業員番号>/  人員データ1件の削除
 *                                                       （kosu/views/member_views.py の MemberDelete）
 * 画面URL    : /member-delete/:employee_no             （index.tsx のルーティング定義）
 * 関連ファイル: styles/MemberPage/MemberDelete.module.css, Components/Loading.tsx
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
import styles from "../styles/MemberPage/MemberDelete.module.css";

// ============================================================
// 型定義
// ============================================================

/** 削除対象の人員データ（GET /api/member_update/<従業員番号>/ のレスポンス。表示する項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（true: 人員・班員の管理画面を使える）
  administrator: boolean; // 管理者（true: 管理者・工数区分定義の編集画面を使える）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 人員削除画面。
 *
 * 表示時にURLの従業員番号で人員データを取得して表に表示し、「削除」ボタンで削除する。
 *
 * @returns 人員削除画面のJSX
 */
const MemberDelete: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const { employee_no } = useParams<{ employee_no: string }>(); // URLの :employee_no 部分（削除対象の従業員番号。文字列）
  const employeeNo = Number(employee_no); // URLの従業員番号を数値に変換したもの（APIのURLに使う）
  const [record, setRecord] = useState<Member | null>(null); // 表示する人員データ（取得前・取得失敗時は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大高さ（px）。超えた分は縦スクロール
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の外枠の幅（px）。表の実幅＋5px
  // 表のDOM要素を参照する（実際の表示幅を測るため。測るだけなので再描画が不要な ref を使う）
  const tableRef = useRef<HTMLTableElement>(null);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLの従業員番号が変わったとき: 削除対象の人員データを取得する
  useEffect(() => {
    /**
     * 人員データ1人分をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（結果は record / error の state に反映）
     */
    const fetchMember = async () => {
      try {
        // GET /api/member_update/<従業員番号>/ : 削除対象の人員データを取得（編集画面と同じAPIを流用）
        const response = await api.get<Member>(`/api/member_update/${employeeNo}/`);
        setRecord(response.data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし（人員の「権限」が付いていない） → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 該当する人員なし など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchMember();
  }, [employeeNo, navigate]);

  // 表示データ（record）が変わったとき: 表の最大高さと幅を計算し直し、画面サイズ変更時にも再計算する
  //   （データ取得後に表が描画されてから幅を測る必要があるため、record を依存配列に入れている）
  useEffect(() => {
    /**
     * 画面の高さから見出しの高さと余白を引いて、表の外枠の最大高さを求める。
     *
     * 計算式: ウィンドウの高さ − 見出し(h1)の高さ − 余白40px
     *
     * @returns なし（maxHeight の state に反映）
     */
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight - 40);
    };

    /**
     * 表の実際の表示幅に5pxの余裕を足して、外枠の幅として保存する（表がまだ無い場合は何もしない）。
     *
     * @returns なし（tableWidth の state に反映）
     */
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth + 5);
      }
    };

    updateMaxHeight();
    updateTableWidth();

    // ウィンドウサイズが変わるたびに再計算する。再実行時・画面を離れるときにイベント登録を解除する（後片付け）
    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [record]);

  // ---------- イベントハンドラ ----------

  /**
   * 「削除」ボタン押下時の処理。
   *
   * 確認ダイアログでOKが押された場合のみ削除APIを呼び、成功したら人員一覧へ戻る。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // 削除すると該当人員の工数入力が見えなくなるため、通常はショップを「退社」に変える運用を促して最終確認する
    // （キャンセルなら中止）
    const confirmed = window.confirm("人員情報を削除すると該当人員の工数入力が見えなくなります。特別な意図がない場合は人員情報の編集でショップ選択を退社に変えるのみにして下さい。削除しますか？");
    if (!confirmed) {
      return;
    }

    try {
      // DELETE /api/member_delete/<従業員番号>/ : 人員データを削除する
      await api.delete(`/api/member_delete/${employeeNo}/`);
      // 成功: 完了を知らせて人員一覧へ戻る
      alert("削除が完了しました");
      navigate("/member-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（404: 該当する人員なし など）: サーバーが返したメッセージを表示
        //   ※403 も個別には扱わずここに入る
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // データを取得できなかった場合はメッセージだけを出す
  if (!record) return <div>データが見つかりません</div>;

  return (
    <>
      {/* ローディング表示（ここでは loading は常に false のため、フェードアウトして1秒後に消える） */}
      <Loading isLoading={loading} />
      <div className={styles["member-delete-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>人員削除</h1>

        {/* 人員一覧画面へ戻るリンク */}
        <nav className={styles["member-nav"]}>
          <Link to="/member-list">人員一覧</Link>
        </nav>

        {/* 確認メッセージ */}
        <p>以下の人員のデータを削除しますか？</p>

        {/* 表の外枠: 最大高さを超えたら縦スクロール。幅は表の実幅＋5px */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          {/* 削除対象の人員データを表示する表（幅を測るため ref を付ける） */}
          <table ref={tableRef}>
            <tbody>
              {/* 従業員番号 */}
              <tr>
                <th className={styles["th-collar"]}>従業員番号</th>
                <td>{record.employee_no}</td>
              </tr>
              {/* 氏名 */}
              <tr>
                <th className={styles["th-collar"]}>氏名</th>
                <td>{record.name}</td>
              </tr>
              {/* ショップ */}
              <tr>
                <th className={styles["th-collar"]}>ショップ</th>
                <td>{record.shop}</td>
              </tr>
              {/* 権限: true なら「有」、false なら「無」と表示 */}
              <tr>
                <th className={styles["th-collar"]}>権限</th>
                <td>{record.authority ? "有" : "無"}</td>
              </tr>
              {/* 管理者権限: true なら「有」、false なら「無」と表示 */}
              <tr>
                <th className={styles["th-collar"]}>管理者権限</th>
                <td>{record.administrator ? "有" : "無"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 削除ボタン */}
        <button onClick={handleDelete} className="yellow_button">
          削除
        </button>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default MemberDelete;