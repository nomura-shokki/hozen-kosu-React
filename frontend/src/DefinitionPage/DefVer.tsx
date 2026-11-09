/**
 * ============================================================
 * ファイル名 : DefVer.tsx
 * 種別       : 画面コンポーネント（工数区分定義切り替え画面）
 * 概要       : 工数入力などで使用する工数区分定義Ver（作業カテゴリの定義セット）を切り替える画面。
 *              選択したVerはサーバー側のセッション（ログイン中ユーザーの情報を
 *              サーバー側で保持する仕組み）に保存される。
 *
 * 主な機能   :
 *   - 登録済みの工数区分定義Ver一覧と、現在使用中のVerの取得・表示
 *   - プルダウンでVerを選び「工数区分定義切り替え」ボタンでセッションの使用Verを変更
 *
 * 使用API    : GET  /api/def_ver/  工数区分定義Ver一覧と現在のVerを取得（kosu/views/def_views.py の DefVer）
 *              POST /api/def_ver/  使用する工数区分定義Verをセッションに保存（同上）
 * 画面URL    : /def-ver             （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefVer.module.css,
 *              Components/DefVersionSelect.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/DefinitionPage/DefVer.module.css";
import Loading from "../Components/Loading"; // 読み込み中の表示
import DefVersionSelect from "../Components/DefVersionSelect"; // 工数区分定義Verを選ぶプルダウン

// ============================================================
// 型定義
// ============================================================

/** 工数区分定義Ver1件分のデータ（プルダウンの選択肢に使う項目のみ定義） */
interface DefData {
  id: number; // 工数区分定義のID（主キー）。プルダウンの key に使う
  kosu_name: string; // 工数区分定義Ver名（プルダウンの表示名・送信値）
}

/** GET /api/def_ver/ のレスポンス */
interface DefVerResponse {
  choices: DefData[]; // 登録済みの工数区分定義Ver全件
  current_version: string; // セッションに保存されている、現在使用中の工数区分定義Ver名
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義切り替え画面。
 *
 * 表示時にVer一覧と現在のVerを取得し、プルダウンの初期値を現在のVerにする。
 * フォーム送信で選択したVerをサーバーへ送り、成功したら画面上の「現在のVer」表示も更新する。
 *
 * @returns 工数区分定義切り替え画面のJSX
 */
const DefVer: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数

  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 画面上部に出すエラーメッセージ（null ならエラーなし）

  const [choices, setChoices] = useState<DefData[]>([]); // プルダウンの選択肢（工数区分定義Ver一覧）
  const [currentVersion, setCurrentVersion] = useState<string>(""); // 現在使用中の工数区分定義Ver名（画面の説明文に表示）
  const [selectedVersion, setSelectedVersion] = useState<string>(""); // プルダウンで選択中の工数区分定義Ver名（送信値）

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: Ver一覧と現在のVerを取得する
  useEffect(() => {
    /**
     * 工数区分定義Ver一覧と現在のVerをサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     * それ以外のエラーは画面上部にメッセージを表示する（画面自体は表示したまま）。
     *
     * @returns なし（結果は choices / currentVersion / selectedVersion / errorMessage の state に反映）
     */
    const fetchVerData = async () => {
      try {
        // GET /api/def_ver/ : 工数区分定義Ver一覧と、セッションに保存中の現在のVerを取得
        const response = await api.get<DefVerResponse>("/api/def_ver/");
        setChoices(response.data.choices);
        setCurrentVersion(response.data.current_version);
        // プルダウンの初期選択を現在のVerにしておく
        setSelectedVersion(response.data.current_version);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };
    fetchVerData();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 「工数区分定義切り替え」ボタン押下（フォーム送信）時の処理。
   *
   * 選択中のVerをサーバーへ送り、セッションの使用Verを切り替える。
   * 成功したら「現在のVer」表示を更新し、完了メッセージをポップアップで出す。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();

    try {
      // POST /api/def_ver/ : versionchoice（選択したVer名）をセッションに保存する
      await api.post("/api/def_ver/", { versionchoice: selectedVersion });
      // 成功: 画面上の「現在のVer」表示を更新し、完了を知らせて前回のエラー表示を消す
      setCurrentVersion(selectedVersion);
      alert("切り替え完了！");
      setErrorMessage(null);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: Ver未選択 など）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      // 念のため読み込み中表示を解除する（この時点で既に false）
      setLoading(false);
    }
  };

  /**
   * プルダウンで工数区分定義Verを選び直したときの処理。
   *
   * @param e - プルダウンの変更イベント（e.target.value が選択したVer名）
   * @returns なし（selectedVersion の state に反映）
   */
  const handleChangeVersion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersion(e.target.value);
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["defver-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数区分定義切り替え</h1>
        {/* 工数区分定義メニュー画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>
        {/* エラーメッセージがあるときだけ表示（role="alert" で読み上げソフトにも通知） */}
        {errorMessage && (
          <div role="alert">{errorMessage}</div>
        )}
        {/* 現在使用中の工数区分定義Ver名 */}
        <p>現在の工数区分のVerは "{currentVersion}" です</p>
        {/* 切り替えフォーム: 送信で handleSubmit を実行する。
            入力欄（input要素）で Enter キーが押されたときは、誤送信を防ぐため送信を止めてフォーカスを外す */}
        <form 
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <label htmlFor="versionchoice">工数区分の選択:</label>
          {/* 工数区分定義Verのプルダウン（id="versionchoice"。選択肢は choices、選択値は selectedVersion） */}
          < DefVersionSelect 
            choices={choices}
            selectedVersion={selectedVersion}
            onChange={handleChangeVersion}
          />
          {/* 送信ボタン */}
          <div className={styles["search-button-row"]}>
            <button type="submit" className="green_button">工数区分定義切り替え</button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefVer;