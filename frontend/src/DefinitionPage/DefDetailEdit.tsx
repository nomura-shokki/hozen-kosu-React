/**
 * ============================================================
 * ファイル名 : DefDetailEdit.tsx
 * 種別       : 画面コンポーネント（作業詳細選択肢編集画面）
 * 概要       : 登録済みの作業詳細の選択肢（定義記号と作業詳細の文言の組）1件を編集する画面。
 *              管理者のみ利用できる。
 *
 * 主な機能   :
 *   - URLのIDに対応する作業詳細選択肢と、定義記号の選択肢一覧を取得して初期表示
 *   - 定義記号・作業詳細を編集して更新し、成功したら作業詳細選択肢一覧へ戻る
 *
 * 使用API    : GET /api/def_detail_update/<id>/  作業詳細選択肢1件と定義記号一覧の取得
 *                                                （kosu/views/def_views.py の DefDetailUpdate）
 *              PUT /api/def_detail_update/<id>/  作業詳細選択肢1件の更新（同上）
 * 画面URL    : /def-detail-update/:id             （index.tsx のルーティング定義。:id は作業詳細選択肢のID）
 * 関連ファイル: styles/DefinitionPage/DefDetailEdit.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, FormEvent } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/DefinitionPage/DefDetailEdit.module.css"; 

// ============================================================
// 型定義
// ============================================================

/** 作業詳細選択肢1件分のデータ（編集フォームの入力内容・PUT の送信データにもなる） */
interface Choice {
  id: number; // 作業詳細選択肢のID（主キー）
  def_symbol: string; // 定義記号（工数区分の記号 "A"〜"x"。"A" が工数区分1。"$" は休憩）
  def_select: string; // 作業詳細（選択肢として表示される文言）
}

/** GET /api/def_detail_update/<id>/ のレスポンス */
interface FetchResponse {
  formData: Choice; // 編集対象の作業詳細選択肢
  symbol_list: string[]; // 定義記号プルダウンの選択肢（使用中の工数区分定義Verの区分数ぶんの記号＋"$"）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 作業詳細選択肢編集画面。
 *
 * 表示時にURLのIDで作業詳細選択肢を取得して入力欄に表示し、更新ボタンでサーバーへ送信する。
 *
 * @returns 作業詳細選択肢編集画面のJSX
 */
const DefDetailEdit: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（編集対象の作業詳細選択肢のID）
  const [formData, setFormData] = useState<Choice | null>(null); // 入力フォームの内容（取得前・取得失敗時は null）
  const [symbolList, setSymbolList] = useState<string[]>([]); // 定義記号プルダウンの選択肢
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLのIDが変わったとき: 編集対象の作業詳細選択肢と定義記号一覧を取得する
  useEffect(() => {
    /**
     * 作業詳細選択肢1件と定義記号の選択肢一覧をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン・定義Verのデータなし）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
     *
     * @returns なし（結果は formData / symbolList / errorMessage の state に反映）
     */
    const fetchChoice = async () => {
      try {
        // GET /api/def_detail_update/<id>/ : 編集対象の作業詳細選択肢と、定義記号の選択肢一覧を取得
        const response = await api.get<FetchResponse>(`/api/def_detail_update/${id}/`);
        setFormData(response.data.formData);
        setSymbolList(response.data.symbol_list);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または使用中の工数区分定義Verのデータが存在しない → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 該当データなし / 400: 同名の工数区分定義Verが複数ある など）: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchChoice();
  }, [id, navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 入力欄・プルダウンの変更時の処理。
   *
   * 入力欄の name 属性（"def_symbol" / "def_select"）と同じ名前の項目を更新する。
   *
   * @param event - 入力欄またはプルダウンの変更イベント
   * @returns なし（formData の state に反映）
   */
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setFormData((prev) => {
      // データ未取得（null）の場合は何も変えない
      if (!prev) return prev;
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  /**
   * 「更新」ボタン押下（フォーム送信）時の処理。
   *
   * 入力内容をサーバーへ送り、成功したら完了メッセージを出して作業詳細選択肢一覧へ戻る。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();

    try {
      // PUT /api/def_detail_update/<id>/ : 作業詳細選択肢1件を更新する（id を含むフォーム内容をそのまま送る）
      await api.put(`/api/def_detail_update/${id}/`,
        formData
      );
      // 成功: 完了を知らせて作業詳細選択肢一覧へ戻る
      alert("データが更新されました！");
      navigate("/def-detail-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（404: 該当データなし / 400: 作業詳細の重複・入力チェックNG など）: サーバーが返したメッセージを表示
        //   ※403 も個別には扱わずここに入る
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す（更新時のエラーでもフォームは表示されなくなる）
  if (errorMessage) return <div>Error: {errorMessage}</div>;
  // データを取得できなかった場合はメッセージだけを出す
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      {/* ローディング表示（ここでは loading は常に false のため、フェードアウトして1秒後に消える） */}
      <Loading isLoading={loading} />
      <div className={styles["choice-edit-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>作業詳細選択肢編集</h1>
        {/* 工数区分定義メニュー画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {/* エラーメッセージがあるときだけ表示（role="alert" で読み上げソフトにも通知）。
            ※エラー時は上の早期 return で別表示になるため、実際にはここは表示されない */}
        {errorMessage && (
          <div role="alert">{errorMessage}</div>
        )}

        {/* 編集フォーム: 送信で handleSubmit を実行する。
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
            >
              <option value="">選択してください</option>
              {/* サーバーから受け取った定義記号を1つずつ選択肢にする（key には記号を使う） */}
              {symbolList.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
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

            {/* 更新ボタン */}
            <button type="submit" className="green_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefDetailEdit;