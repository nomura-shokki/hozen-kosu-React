/**
 * ============================================================
 * ファイル名 : DefDelete.tsx
 * 種別       : 画面コンポーネント（工数区分定義削除画面）
 * 概要       : 登録済みの工数区分定義Ver（作業カテゴリの定義セット）1件の内容を表示し、
 *              確認のうえ削除する画面。管理者のみ利用できる。
 *
 * 主な機能   :
 *   - URLのIDに対応する工数区分定義を取得し、入力済みの工数区分だけを表で表示
 *   - 「削除」ボタンで確認ダイアログを出し、OKなら削除して工数区分定義メニューへ戻る
 *   - 表の高さ・幅を画面サイズと表の中身に合わせて調整
 *
 * 使用API    : GET    /api/def_update/<id>/  工数区分定義1件の取得（kosu/views/def_views.py の DefUpdate）
 *              DELETE /api/def_delete/<id>/  工数区分定義1件の削除（kosu/views/def_views.py の DefDelete）
 * 画面URL    : /def-delete/:id               （index.tsx のルーティング定義。:id は工数区分定義のID）
 * 関連ファイル: styles/DefinitionPage/DefDelete.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useEffect, useState, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useParams, useNavigate, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/DefinitionPage/DefDelete.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数区分1つ分の表示内容（変動/固定はこの画面では表示しないため持たない） */
interface KosuDefinition {
  title: string; // 工数区分名（サーバー側は kosu_title_N）
  division1: string; // 定義（サーバー側は kosu_division_1_N）
  division2: string; // 作業内容（サーバー側は kosu_division_2_N）
}

/** 削除対象の工数区分定義の表示内容 */
interface FormData {
  kosu_name: string; // 工数区分定義Ver名
  kosu_definitions: KosuDefinition[]; // 工数区分1〜50 の内容（配列の0番目が工数区分1）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義削除画面。
 *
 * 表示時にURLのIDで工数区分定義を取得して表に表示し、「削除」ボタンで削除する。
 *
 * @returns 工数区分定義削除画面のJSX
 */
const DefDelete: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（削除対象の工数区分定義のID）
  const navigate = useNavigate(); // 画面遷移用の関数
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight); // 表の外枠の最大高さ（px）。超えた分は縦スクロール
  const [formData, setFormData] = useState<FormData | null>(null); // 表示する工数区分定義の内容（取得前・取得失敗時は null）
  const [loading, setLoading] = useState(true); // 読み込み中かどうか（Loading 部品に渡す）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [tableWidth, setTableWidth] = useState<number>(0); // 表の実際の幅（px）。外枠の幅を合わせるために使う
  // 表のDOM要素を参照する（実際の表示幅を測るため。測るだけなので再描画が不要な ref を使う）
  const tableRef = useRef<HTMLTableElement>(null);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLのIDが変わったとき: 削除対象の工数区分定義を取得して表示用に変換する
  useEffect(() => {
    /**
     * 工数区分定義1件をサーバーから取得し、表示用の形に変換して state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
     *
     * @returns なし（結果は formData / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/def_update/<id>/ : 削除対象の工数区分定義1件を取得（編集画面と同じAPIを流用）
        const response = await api.get(`/api/def_update/${id}/`);
        const rawData = response.data;

        // kosu_title_1〜50 などの平らなキーを、工数区分ごとのオブジェクト50個の配列に変換する
        //   未入力（null）の項目は空文字にする（表示時の split でエラーにならないようにするため）
        const kosu_definitions = Array.from({ length: 50 }, (_, i) => {
          const idx = i + 1; // 工数区分の番号（1始まり）
          return {
            title: rawData[`kosu_title_${idx}`] || "",
            division1: rawData[`kosu_division_1_${idx}`] || "",
            division2: rawData[`kosu_division_2_${idx}`] || "",
          };
        });

        setFormData({
          kosu_name: rawData.kosu_name || "",
          kosu_definitions,
        });
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
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

    fetchData();
  }, [id, navigate]);

  // 初回表示時（依存配列が空なので1回だけ）: 表の最大高さを計算し、画面サイズ変更時にも再計算する
  useEffect(() => {
    /**
     * 画面の高さから見出し等の高さを引いて、表の外枠の最大高さを求める。
     *
     * 計算式: ウィンドウの高さ − 検索欄の高さ − 見出し(h1)の高さ − 余白40px
     * ※CSS Modules ではクラス名が自動で変換されるため、".search-bar" に一致する要素は通常なく 0 になる
     *
     * @returns なし（maxHeight の state に反映）
     */
    const updateMaxHeight = () => {
      const searchBarHeight = (document.querySelector(".search-bar") as HTMLElement)?.offsetHeight || 0;
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - searchBarHeight - headerHeight - 40);
    };

    updateMaxHeight();
    // ウィンドウサイズが変わるたびに再計算する。画面を離れるときにイベント登録を解除する（後片付け）
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  // 表示データ（formData）が変わったとき: 表の実際の幅を測り直し、画面サイズ変更時にも測り直す
  //   （データ取得後に表が描画されてから幅を測る必要があるため、formData を依存配列に入れている）
  useEffect(() => {
    /**
     * 表の実際の表示幅を測って state に保存する（表がまだ無い場合は何もしない）。
     *
     * @returns なし（tableWidth の state に反映）
     */
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    // ウィンドウサイズが変わるたびに測り直す。再実行時・画面を離れるときにイベント登録を解除する（後片付け）
    window.addEventListener("resize", updateTableWidth);
    return () => window.removeEventListener("resize", updateTableWidth);
  }, [formData]);

  // ---------- イベントハンドラ ----------

  /**
   * 「削除」ボタン押下時の処理。
   *
   * 確認ダイアログでOKが押された場合のみ削除APIを呼び、成功したら工数区分定義メニューへ戻る。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // 削除は工数入力に影響する可能性があるため、最終確認する（キャンセルなら中止）
    const confirmed = window.confirm("この工数区分定義を削除しますか？関連する工数入力に影響が出る可能性があります。");
    if (!confirmed) return;

    try {
      // DELETE /api/def_delete/<id>/ : 工数区分定義1件を削除する
      await api.delete(`/api/def_delete/${id}/`);
      // 成功: 完了を知らせて工数区分定義メニューへ戻る
      alert("削除が完了しました");
      navigate("/def-menu");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404: 該当データなし など）: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
    } finally {
      // 念のため読み込み中表示を解除する（この時点で既に false）
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div role="alert">Error: {error}</div>;
  // データがまだ無い場合（取得中を含む）はメッセージだけを出す
  if (!formData) return <div>定義が見つかりません</div>;

  return (
    <>
      {/* ローディング表示（loading が false になるとフェードアウトして1秒後に消える） */}
      <Loading isLoading={loading} />
      <div className={styles["def-delete-wrapper"]}>
        {/* 画面タイトルと確認メッセージ */}
        <h1 className={styles["h1-collar"]}>工数区分定義削除</h1>
        <p>以下の定義データを削除しますか？</p>

        {/* 工数区分定義一覧画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-list">工数区分定義一覧</Link>
        </nav>
        {/* 削除ボタン（上部。表が長いため上下両方に置いている） */}
        <button onClick={handleDelete} className="green_button">削除</button>
        {/* 表の外枠: 最大高さを超えたら縦スクロール。幅は表の実幅＋20px（スクロールバー分の余裕） */}
        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            width: `${tableWidth + 20}px`,
          }}
        >
          {/* 削除対象の内容を表示する表（幅を測るため ref を付ける） */}
          <table ref={tableRef}>
            <tbody>
              {/* 1行目: 工数区分定義Ver名 */}
              <tr>
                <th className={styles["th-collar"]}>定義Ver名</th>
                <td className={styles["td-left"]}>{formData.kosu_name}</td>
              </tr>

              {/* 工数区分1〜50 のうち、工数区分名・定義・作業内容のどれかが入力されている番号だけを表示する。
                  1つの工数区分につき「工数区分名」「定義」「作業内容」の3行を出す（key には配列の番号を使う）。
                  見出しセルの色は工数区分ごとに交互に切り替える（工数区分1・3・5… は th-collar-alt） */}
              {formData.kosu_definitions.map((def, index) => (
                def.title || def.division1 || def.division2 ? (
                  <React.Fragment key={index}>
                    {/* 工数区分名（改行を含む場合は <br /> で改行して表示） */}
                    <tr>
                      <th className={index % 2 === 1 ? styles["th-collar"] : styles["th-collar-alt"]}>
                        工数区分名{index + 1}
                      </th>
                      <td className={styles["td-left"]}>{def.title.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</td>
                    </tr>
                    {/* 定義（改行ごとに分割して <br /> で改行して表示） */}
                    <tr>
                      <th className={index % 2 === 1 ? styles["th-collar"] : styles["th-collar-alt"]}>
                        定義{index + 1}
                      </th>
                      <td className={styles["td-left"]}>{def.division1.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</td>
                    </tr>
                    {/* 作業内容（改行ごとに分割して <br /> で改行して表示） */}
                    <tr>
                      <th className={index % 2 === 1 ? styles["th-collar"] : styles["th-collar-alt"]}>
                        作業内容{index + 1}
                      </th>
                      <td className={styles["td-left"]}>{def.division2.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</td>
                    </tr>
                  </React.Fragment>
                ) : null
              ))}

            </tbody>
          </table>
        </div>

        {/* 削除ボタン（下部） */}
        <button onClick={handleDelete} className="green_button">削除</button>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefDelete;