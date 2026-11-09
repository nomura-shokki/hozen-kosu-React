/**
 * ============================================================
 * ファイル名 : DefDetailDelete.tsx
 * 種別       : 画面コンポーネント（作業詳細選択肢削除画面）
 * 概要       : 登録済みの作業詳細の選択肢（定義記号と作業詳細の文言の組）1件の内容を表示し、
 *              削除する画面。管理者のみ利用できる。
 *
 * 主な機能   :
 *   - URLのIDに対応する作業詳細選択肢を取得して表で表示
 *   - 「削除」ボタンで削除し、成功したら作業詳細選択肢一覧へ戻る（確認ダイアログはなし）
 *   - 表の高さ・幅を画面サイズと表の中身に合わせて調整
 *
 * 使用API    : GET    /api/def_detail_update/<id>/  作業詳細選択肢1件の取得
 *                                                   （kosu/views/def_views.py の DefDetailUpdate）
 *              DELETE /api/def_detail_delete/<id>/  作業詳細選択肢1件の削除
 *                                                   （kosu/views/def_views.py の DefDetailDelete）
 * 画面URL    : /def-detail-delete/:id               （index.tsx のルーティング定義。:id は作業詳細選択肢のID）
 * 関連ファイル: styles/DefinitionPage/DefDetailDelete.module.css, Components/Loading.tsx
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
import styles from "../styles/DefinitionPage/DefDetailDelete.module.css";

// ============================================================
// 型定義
// ============================================================

/** 作業詳細選択肢1件分のデータ */
interface Choice {
  id: number; // 作業詳細選択肢のID（主キー）
  def_symbol: string; // 定義記号（工数区分の記号 "A"〜"x"。"A" が工数区分1。"$" は休憩）
  def_select: string; // 作業詳細（選択肢として表示される文言）
}

/** GET /api/def_detail_update/<id>/ のレスポンス（編集画面と同じAPIを流用） */
interface FetchResponse {
  formData: Choice; // 削除対象の作業詳細選択肢
  symbol_list: string[]; // 定義記号の選択肢一覧（この画面では使わない）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 作業詳細選択肢削除画面。
 *
 * 表示時にURLのIDで作業詳細選択肢を取得して表に表示し、「削除」ボタンで削除する。
 * ※コンポーネント名は MemberDelete だが、内容は作業詳細選択肢の削除画面である
 *   （index.tsx では DefDetailDelete という名前で import している）。
 *
 * @returns 作業詳細選択肢削除画面のJSX
 */
const MemberDelete: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（削除対象の作業詳細選択肢のID）
  const [record, setRecord] = useState<Choice | null>(null); // 表示する作業詳細選択肢（取得前・取得失敗時は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大高さ（px）。超えた分は縦スクロール
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の外枠の幅（px）。表の実幅＋5px
  // 表のDOM要素を参照する（実際の表示幅を測るため。測るだけなので再描画が不要な ref を使う）
  const tableRef = useRef<HTMLTableElement>(null);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLのIDが変わったとき: 削除対象の作業詳細選択肢を取得する
  useEffect(() => {
    /**
     * 作業詳細選択肢1件をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・定義Verのデータなし）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
     *
     * @returns なし（結果は record / error の state に反映）
     */
    const fetchChoice = async () => {
      try {
        // GET /api/def_detail_update/<id>/ : 削除対象の作業詳細選択肢を取得（編集画面と同じAPIを流用）
        const response = await api.get<FetchResponse>(`/api/def_detail_update/${id}/`);
        setRecord(response.data.formData);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または使用中の工数区分定義Verのデータが存在しない → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 該当データなし など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchChoice();
  }, [id, navigate]);

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
   * 確認ダイアログは出さずにすぐ削除APIを呼び、成功したら作業詳細選択肢一覧へ戻る。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    try {
      // DELETE /api/def_detail_delete/<id>/ : 作業詳細選択肢1件を削除する
      await api.delete(`/api/def_detail_delete/${id}/`);
      // 成功: 完了を知らせて作業詳細選択肢一覧へ戻る
      alert("削除が完了しました");
      navigate("/def-detail-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（404: 該当データなし など）: サーバーが返したメッセージを表示
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
      <div className={styles["choice-delete-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>作業詳細選択肢削除</h1>
        {/* 工数区分定義メニュー画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {/* 確認メッセージ */}
        <p>以下の作業詳細データを削除しますか？</p>

        {/* 表の外枠: 最大高さを超えたら縦スクロール。幅は表の実幅＋5px */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          {/* 削除対象の内容を表示する表（幅を測るため ref を付ける） */}
          <table ref={tableRef}>
            <tbody>
              {/* 定義記号 */}
              <tr>
                <th className={styles["th-collar"]}>定義記号</th>
                <td>{record.def_symbol}</td>
              </tr>
              {/* 作業詳細 */}
              <tr>
                <th className={styles["th-collar"]}>作業詳細</th>
                <td>{record.def_select}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 削除ボタン */}
        <button onClick={handleDelete} className="green_button">
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