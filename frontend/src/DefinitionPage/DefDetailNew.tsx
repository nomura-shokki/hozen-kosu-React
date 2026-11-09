/**
 * ============================================================
 * ファイル名 : DefDetailNew.tsx
 * 種別       : 画面コンポーネント（作業詳細選択肢登録画面）
 * 概要       : 工数入力で選べる作業詳細の選択肢（定義記号と作業詳細の文言の組）を新規登録する画面。
 *              管理者のみ利用できる。
 *
 * 主な機能   :
 *   - 使用中の工数区分定義Verを取得し、定義記号のプルダウン（A〜x と 休憩の $）を作成
 *   - 定義記号と作業詳細を入力して登録（登録後は入力欄を空にして続けて登録できる）
 *
 * 使用API    : GET  /api/def_detail_new/  使用中の工数区分定義Verのデータ取得
 *                                         （kosu/views/def_views.py の DefDetailNew）
 *              POST /api/def_detail_new/  作業詳細選択肢の新規登録（同上）
 * 画面URL    : /def-detail-new             （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefDetailNew.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/DefinitionPage/DefDetailNew.module.css";

// ============================================================
// 型定義
// ============================================================

/** 登録フォームの入力内容（POST /api/def_detail_new/ の送信データ） */
interface FormData {
  def_symbol: string; // 定義記号（工数区分の記号 "A"〜"x"。"A" が工数区分1。"$" は休憩）
  def_select: string; // 作業詳細（選択肢として表示される文言）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 作業詳細選択肢登録画面。
 *
 * 表示時に使用中の工数区分定義Verを取得し、工数区分の数に合わせて定義記号の選択肢を作る。
 * 登録ボタンでサーバーへ送信し、成功したら入力欄を空に戻す。
 *
 * @returns 作業詳細選択肢登録画面のJSX
 */
const DefDetailNew: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 画面上部に出すエラーメッセージ（null ならエラーなし）
  // 入力フォームの内容（初期値は空）
  const [formData, setFormData] = useState<FormData>({
    def_symbol: "",
    def_select: "",
  });

  // 使用中の工数区分定義Verのデータ（kosu_title_1〜50 などを含む。取得前は null）
  const [defData, setDefData] = useState<any>(null);

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: 使用中の工数区分定義Verを取得する
  useEffect(() => {
    /**
     * 使用中の工数区分定義Verのデータをサーバーから取得し、state に保存する。
     * 取得に成功すること自体が「この画面を使ってよい」ことの確認も兼ねる。
     *
     * 401（未ログイン・定義Verのデータなし）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
     *
     * @returns なし（結果は defData / errorMessage の state に反映）
     */
    const checkAuth = async () => {
      try {
        // GET /api/def_detail_new/ : セッションで選択中の工数区分定義Verのデータを1件取得
        const response = await api.get("/api/def_detail_new/");
        setDefData(response.data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または使用中の工数区分定義Verのデータが存在しない → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（400: 同名の工数区分定義Verが複数ある など）: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // ---------- ヘルパー関数 ----------

  /**
   * 定義記号プルダウンの選択肢を作る。
   *
   * 工数区分名が入力されている最後の番号（maxIndex）を求め、
   * 工数区分1〜maxIndex に対応する記号（1→"A" … 26→"Z"、27→"a" … 50→"x"）と、
   * 休憩を表す "$" を選択肢にする。
   * 例: 工数区分名が 1〜3 まで入力されている → A, B, C, $
   *
   * @returns 選択肢の配列（value: 送信値 / label: 表示名）。定義Ver未取得なら空配列
   */
  const getSymbolOptions = () => {
    if (!defData) return [];

    // 工数区分1〜50 を順に調べ、工数区分名が入っている最大の番号を記録する
    //   （途中に空きがあっても、それより後ろに入力があればその番号まで含める）
    let maxIndex = 0;
    for (let i = 1; i <= 50; i++) {
      if (defData[`kosu_title_${i}`]) {
        maxIndex = i;
      }
    }

    // 工数区分の番号順に並べた記号の文字列（0文字目 "A" が工数区分1、49文字目 "x" が工数区分50）
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";
    const options = [];

    // 工数区分1〜maxIndex に対応する記号を選択肢に追加する
    for (let i = 0; i < maxIndex; i++) {
      if (alphabet[i]) {
        options.push({ value: alphabet[i], label: alphabet[i] });
      }
    }
    // 最後に休憩を表す記号 "$" を追加する
    options.push({ value: "$", label: "$" });
    return options;
  };

  // ---------- イベントハンドラ ----------

  /**
   * 入力欄・プルダウンの変更時の処理。
   *
   * 入力欄の name 属性（"def_symbol" / "def_select"）と同じ名前の項目を更新する。
   * チェックボックスの場合はチェック状態（true/false）を入れる（現在この画面にチェックボックスはない）。
   *
   * @param event - 入力欄またはプルダウンの変更イベント
   * @returns なし（formData の state に反映）
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    // チェックボックス: checked（true/false）を保存する
    if (type === "checkbox") {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      // テキスト入力・プルダウン: 入力値をそのまま保存する
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  /**
   * 「登録」ボタン押下（フォーム送信）時の処理。
   *
   * 入力内容をサーバーへ送り、成功したら完了メッセージを出して入力欄を空に戻す
   * （画面は移動しないので、続けて別の選択肢を登録できる）。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();
    // 前回のエラー表示を消す
    setErrorMessage(null);

    try {
      // POST /api/def_detail_new/ : 作業詳細選択肢を新規登録する
      await api.post("/api/def_detail_new/", formData);
      alert("登録完了！");

      // 成功: 続けて入力できるよう入力欄を空に戻す
      setFormData({
        def_symbol: "",
        def_select: "",
      });
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 作業詳細の重複・入力チェックNG）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  // 定義記号プルダウンの選択肢（描画のたびに defData から作り直す）
  const symbolOptions = getSymbolOptions();

  return (
    <div className={styles["choice-new-wrapper"]}>
      {/* 画面タイトル */}
      <h1 className={styles["h1-collar"]}>作業詳細選択肢登録</h1>
      {/* 工数区分定義メニュー画面へ戻るリンク */}
      <nav className={styles["def-nav"]}>
        <Link to="/def-menu">工数区分定義MENU</Link>
      </nav>

      {/* エラーメッセージがあるときだけ表示（role="alert" で読み上げソフトにも通知） */}
      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

      {/* 登録フォーム: 送信で handleSubmit を実行する。
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
        <div className={styles["search-bar"]}>
          {/* 定義記号のプルダウン（「選択してください」＝空文字は未選択） */}
          <label htmlFor="def_symbol">定義記号:</label>
          <select
            id="def_symbol"
            name="def_symbol"
            value={formData.def_symbol}
            onChange={handleChange}
            className={styles["select-input"]}
          >
            <option value="">選択してください</option>
            {/* 工数区分の数に合わせた記号と "$" を1つずつ選択肢にする（key には記号を使う） */}
            {symbolOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 作業詳細の入力欄 */}
          <label htmlFor="def_select">作業詳細:</label>
          <input
            type="text"
            id="def_select"
            name="def_select"
            value={formData.def_select}
            onChange={handleChange}
          />
          {/* 登録ボタン */}
          <button type="submit" className="green_button">登録</button>
        </div>
      </form>
    </div>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefDetailNew;