/**
 * ============================================================
 * ファイル名 : InquirUpdate.tsx
 * 種別       : 画面コンポーネント（問い合わせ編集画面）
 * 概要       : URL で指定されたIDの問い合わせ1件を編集・削除する画面。
 *              問い合わせた本人は内容・本文を、管理者はそれに加えて回答を入力できる。
 *
 * 主な機能   :
 *   - 問い合わせデータ1件の取得とフォームへの表示
 *     （問い合わせた本人・問い合わせ担当者以外が開くとサーバーが 403 を返し、メインメニューへ戻る）
 *   - 内容・本文（管理者は回答も）を編集して「編集」ボタンで更新 → 問い合わせ履歴画面へ戻る
 *     （サーバー側では、内容・本文が変わると担当者宛て、回答が変わると問い合わせ者宛てのお知らせが書き込まれる）
 *   - 「削除」ボタンで確認のうえ削除 → 問い合わせ履歴画面へ戻る
 *     （サーバー側では、この問い合わせに関するお知らせも消される）
 *
 * 使用API    : GET    /api/inquir_update/<id>/  問い合わせデータ・ログイン者データ取得（kosu/views/inquiry_views.py の InquirUpdate）
 *              PUT    /api/inquir_update/<id>/  問い合わせデータ更新（同上）
 *              DELETE /api/inquir_update/<id>/  問い合わせデータ削除（同上）
 * 画面URL    : /inquir-update/:id            （index.tsx のルーティング定義。:id は問い合わせデータのID）
 * 関連ファイル: styles/InquirPage/InquirUpdate.module.css, Components/ItemSelect.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import ItemSelect from "../Components/ItemSelect"; // 問い合わせ内容（要望/不具合/問い合わせ）のプルダウン
import styles from "../styles/InquirPage/InquirUpdate.module.css";

// ============================================================
// 型定義
// ============================================================

/**
 * 問い合わせデータ1件（レスポンスの inquir_data。画面で使う項目のみ定義）。
 * 実際にはサーバーから届いた全項目（id・登録日時なども含む）がそのまま入り、PUT でもそのまま送信される。
 */
interface Inquir {
  employee_no2: number; // 問い合わせ者の従業員番号
  name: string; // 氏名（サーバーでは人員データへの外部キー＝人員データのID が入る）
  content_choice: string; // 内容（"要望" / "不具合" / "問い合わせ"）
  inquiry: string; // 問い合わせ本文
  answer: string; // 回答（未回答なら空文字）
}

/** ログイン者の人員データ（レスポンスの login_data。画面で使う項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ
  authority: boolean; // 権限
  administrator: boolean; // 管理者（true なら回答の入力欄を表示）
}

/** GET /api/inquir_update/<id>/ のレスポンス全体 */
interface Response {
  inquir_data: Inquir; // 編集する問い合わせデータ
  login_data: Member; // ログイン者の人員データ
  inquir_member_data: Member; // 問い合わせ者の人員データ（※現在のサーバー実装では返されず、この画面でも使っていない）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 問い合わせ編集画面。
 *
 * URL の :id の問い合わせデータを取得してフォームに表示し、更新・削除を行う。
 *
 * @returns 問い合わせ編集画面のJSX
 */
const InquirUpdate: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<Inquir | null>(null); // フォームに表示・編集中の問い合わせデータ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const { id } = useParams<{ id: string }>(); // URL の :id（問い合わせデータのID）
  const [memberData, setMemberData] = useState<Member | null>(null); // ログイン者の人員データ

  // ---------- 副作用（useEffect） ----------

  // URL の :id が変わったとき（初回表示時を含む）: 問い合わせデータを取得してフォームに入れる
  useEffect(() => {
    /**
     * 問い合わせデータとログイン者データをサーバーから取得し、state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（本人・問い合わせ担当者以外）ならメインメニューへ遷移する。
     * 404（該当IDなし）などはメッセージを表示する。
     *
     * @returns なし（結果は formData / memberData / error の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/inquir_update/<id>/ : 編集する問い合わせデータとログイン者データを取得
        const response = await api.get<Response>(`/api/inquir_update/${id}/`);
        const { inquir_data, login_data } = response.data;
        setFormData(inquir_data);
        setMemberData(login_data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 問い合わせた本人でも問い合わせ担当者でもない → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404 など）: サーバーが返したメッセージを表示
          else setError(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * テキスト入力欄（問い合わせ本文・回答）の変更を formData に反映する。
   *
   * 入力欄の name 属性をそのまま formData のキーとして使う（name="answer" → formData.answer）。
   *
   * @param event - 入力欄の変更イベント
   * @returns なし
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prevData) => {
      // データ取得前（null）なら何もしない
      if (!prevData) return null;
      // 直前の値をコピーし、変更された項目だけ上書きする
      return {
        ...prevData,
        [name]: value,
      } as Inquir;
    });
  };

  /**
   * 内容プルダウン（ItemSelect）の変更を formData.content_choice に反映する。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleContentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormData((prevData) => {
      // データ取得前（null）なら何もしない
      if (!prevData) return null;
      // 直前の値をコピーし、内容（content_choice）だけ上書きする
      return {
        ...prevData,
        content_choice: value,
      } as Inquir;
    });
  };

  /**
   * 「編集」ボタン押下（フォーム送信）時の処理。
   *
   * フォームの内容を PUT で送信し、成功したらアラートを出して問い合わせ履歴画面へ戻る。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
   * 400（入力内容がサーバーの検証に通らない）などはメッセージを表示する。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページの再読み込み）を止め、API 通信で更新する
    event.preventDefault();
    // 前回のエラーメッセージを消す
    setError(null);

    // データ取得前なら送信しない
    if (!formData) return;

    try {
      // PUT /api/inquir_update/<id>/ : 問い合わせデータを更新（フォームの値をまるごと送信）
      await api.put(`/api/inquir_update/${id}/`, formData);
      alert("登録完了！");
      navigate("/inquir-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400 など）: サーバーが返したメッセージを表示（フォームの代わりにエラー表示になる）
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 読み込み中表示を終了する（送信処理では true にしていないため、実際には値は変わらない）
      setLoading(false);
    }
  };

  /**
   * 「削除」ボタン押下時の処理。
   *
   * 確認ダイアログで OK が押された場合のみ DELETE を送信し、成功したら問い合わせ履歴画面へ戻る。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
   *
   * @returns なし
   */
  const handleDelete = async () => {
    // 削除は取り消せないため、ブラウザの確認ダイアログで意思を確認する（キャンセルなら中止）
    const confirmed = window.confirm("削除すると戻せません。削除しますか？");
    if (!confirmed) return;

    try {
      // DELETE /api/inquir_update/<id>/ : 問い合わせデータを削除（関連するお知らせもサーバー側で消される）
      await api.delete(`/api/inquir_update/${id}/`);
      alert("削除が完了しました");
      navigate("/inquir-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404 など）: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 読み込み中表示を終了する（削除処理では true にしていないため、実際には値は変わらない）
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // データが取得できなかった場合
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      {/* ローディング表示（ここに来た時点で loading は false のため、1秒かけてフェードアウトして消える） */}
      <Loading isLoading={loading} />
      <div className={styles["inquir-update-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>問い合わせ編集</h1>
        {/* 問い合わせ履歴画面へ戻るリンク */}
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-list">問い合わせ履歴</Link>
        </nav>

        {/* 編集フォーム: 送信（「編集」ボタン）で handleSubmit を実行する */}
        {/* onKeyDown: 1行入力欄（input 要素）で Enter を押してもフォームが送信されないよう止め、入力欄からフォーカスを外す */}
        {/* （現在このフォームに input 要素はなく、内容はプルダウン、本文・回答は textarea のため、実際に止める対象はない） */}
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
            {/* 内容（要望/不具合/問い合わせ）の選択 */}
            <label htmlFor="ItemSelect">内容選択:</label>
            <ItemSelect
              id="ItemSelect"
              name="content_choice"
              value={formData.content_choice}
              onChange={handleContentChange}
            />
            {/* 問い合わせ本文の入力欄（5行分の高さ） */}
            <label htmlFor="inquiry">問い合わせ：</label>
            <textarea
              id="inquiry"
              name="inquiry"
              value={formData.inquiry}
              onChange={handleChange}
              rows={5}
            />
            {/* 回答の入力欄: ログイン者が管理者のときだけ表示 */}
            {memberData?.administrator && (
              <>
                <label htmlFor="answer">回答：</label>
                <textarea
                  id="answer"
                  name="answer"
                  value={formData.answer}
                  onChange={handleChange}
                  rows={5}
                />
              </>
            )}
            {/* ボタン群: 「編集」はフォーム送信（更新）、「削除」は type="button" なので送信せず handleDelete を実行 */}
            <div className={styles["pagination-buttons"]}>
              <button type="submit" className="pink_button">編集</button>
              <button type="button" onClick={handleDelete} className="pink_button">削除</button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default InquirUpdate;