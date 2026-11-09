/**
 * ============================================================
 * ファイル名 : DefSearch.tsx
 * 種別       : 画面コンポーネント（工数区分定義確認画面）
 * 概要       : 現在使用中の工数区分定義Ver（作業カテゴリの定義セット）に含まれる工数区分を
 *              プルダウンで1つ選ぶと、その「定義」と「作業内容」を表示する画面。
 *              工数入力時に、どの工数区分を選べばよいか確認するために使う。
 *
 * 主な機能   :
 *   - セッションで選択中の工数区分定義Verのデータを取得
 *   - 工数区分名（最大50個）をプルダウンに並べる
 *   - 選択した工数区分の定義・作業内容を表示
 *   - 工数区分定義メニュー画面・工数入力画面へのリンク
 *
 * 使用API    : GET /api/def_search/  使用中の工数区分定義Verのデータ取得（kosu/views/def_views.py の DefSearch）
 * 画面URL    : /def-search            （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefSearch.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/DefinitionPage/DefSearch.module.css";


// ============================================================
// 型定義
// ============================================================

/**
 * 工数区分定義1件分のデータ（GET /api/def_search/ のレスポンス配列の要素）。
 *
 * 実際には kosu_title_1〜50（工数区分名）、kosu_division_1_1〜50（定義）、
 * kosu_division_2_1〜50（作業内容）などが入るため、番号付きの項目はインデックス型でまとめて受ける。
 */
interface DivisionData {
  id: number; // 工数区分定義のID（主キー）。プルダウンの key に使う
  kosu_title_1?: string | null; // 工数区分名1（2〜50 も同じ形式）
  kosu_division_1_1?: string | null; // 工数区分1の定義（2〜50 も同じ形式）
  kosu_division_2_1?: string | null; // 工数区分1の作業内容（2〜50 も同じ形式）
  [key: string]: any; // 上記以外の番号付き項目（kosu_title_N など）を文字列キーで参照できるようにする
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義確認画面。
 *
 * 表示時に使用中の工数区分定義Verのデータを取得し、工数区分名をプルダウンに並べる。
 * 工数区分を選ぶと、その定義と作業内容を画面下部に表示する。
 *
 * @returns 工数区分定義確認画面のJSX
 */
const DefSearch: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数

  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [divisions, setDivisions] = useState<DivisionData[]>([]); // 使用中の工数区分定義Verのデータ（通常1件）
  const [selectedDivision, setSelectedDivision] = useState<string>(""); // プルダウンで選択中の工数区分名（未選択は空文字）
  const [selectedDef1, setSelectedDef1] = useState<string | null>(""); // 選択した工数区分の定義
  const [selectedDef2, setSelectedDef2] = useState<string | null>(""); // 選択した工数区分の作業内容

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: 使用中の工数区分定義Verのデータを取得する
  useEffect(() => {
    /**
     * 使用中の工数区分定義Verのデータをサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（結果は divisions / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/def_search/ : セッションで選択中の工数区分定義Ver名と一致するデータを取得
        const response = await api.get<DivisionData[]>("/api/def_search/");
        setDivisions(response.data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * プルダウンで工数区分を選んだときの処理。
   *
   * 選ばれた工数区分名と一致する kosu_title_N を探し、同じ番号 N の
   * 定義（kosu_division_1_N）と作業内容（kosu_division_2_N）を表示用の state に入れる。
   * 「選択してください」（空文字）に戻した場合は表示を空にする。
   *
   * @param event - プルダウンの変更イベント（event.target.value が選択した工数区分名）
   * @returns なし（selectedDivision / selectedDef1 / selectedDef2 の state に反映）
   */
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTitle = event.target.value;
    setSelectedDivision(selectedTitle);

    // 工数区分が選ばれている場合: 定義・作業内容を探して表示する
    if (selectedTitle) {
      let found = false; // 一致する工数区分が見つかったかどうか
      divisions.forEach((division) => {
        // 工数区分1〜50 を順に調べ、工数区分名が一致する番号を探す
        for (let i = 1; i <= 50; i++) {
          if (division[`kosu_title_${i}`] === selectedTitle) {
            // 同じ番号の「定義」「作業内容」を表示用 state に入れ、この定義セット内の検索を打ち切る
            setSelectedDef1(division[`kosu_division_1_${i}`]);
            setSelectedDef2(division[`kosu_division_2_${i}`]);
            found = true;
            break;
          }
        }
        // 見つかった場合はこの要素の処理を終える
        // （forEach 内の return は次の要素へ進むだけで、ループ全体は止まらない）
        if (found) {
          return;
        }
      });
    } else {
      // 「選択してください」に戻した場合: 定義・作業内容の表示を空にする
      setSelectedDef1("");
      setSelectedDef2("");
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <div className={styles["def-search-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数区分定義確認</h1>
        {/* 工数区分定義メニュー画面・工数入力画面へのリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
          <Link to="/kosu-new">工数入力</Link>
        </nav>

        {/* 工数区分の選択欄（送信はせず、選択の変化だけを handleSelectChange で扱う） */}
        <form>
          <div className={styles["search-bar"]}>
            <label htmlFor="division-select">定義確認する工数区分選択:</label>
            {/* 工数区分のプルダウン（選択値は selectedDivision） */}
            <select
              id="division-select"
              name="division-select"
              value={selectedDivision}
              onChange={handleSelectChange}
            >
              {/* 未選択状態の選択肢 */}
              <option value="">選択してください</option>
              {/* データがあれば工数区分名を選択肢として並べ、なければ「データが存在しません」を出す */}
              {divisions.length > 0 ? (
                // 定義セットごとに工数区分1〜50 を調べ、工数区分名が入っている番号だけを選択肢にする
                //   key は「定義ID-番号（0始まり）」で一意にする
                divisions.flatMap((division) => {
                  return Array.from({ length: 50 }).map((_, i) => {
                    const title = division[`kosu_title_${i + 1}`];
                    // 工数区分名が空（未登録）の番号は何も表示しない
                    return (
                      title && (
                        <option key={`${division.id}-${i}`} value={title}>
                          {title}
                        </option>
                      )
                    );
                  });
                })
              ) : (
                <option disabled>データが存在しません</option>
              )}
            </select>
          </div>
        </form>

        {/* 選択した工数区分の定義・作業内容の表示欄 */}
        <div className={styles["definition-content"]}>
          {/* 定義（未選択・空の場合は代わりの文言を表示） */}
          <h2>定義:</h2> 
          <p>{selectedDef1 || "該当する定義がありません"}</p>

          {/* 作業内容（未選択・空の場合は代わりの文言を表示） */}
          <h2>作業内容:</h2>
          <p>{selectedDef2 || "該当する作業内容がありません"}</p>
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefSearch;