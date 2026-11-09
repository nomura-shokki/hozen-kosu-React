/**
 * ============================================================
 * ファイル名 : InquirDetail.tsx
 * 種別       : 画面コンポーネント（問い合わせ詳細画面）
 * 概要       : URL で指定されたIDの問い合わせ1件について、問い合わせ者・内容・本文・回答を表示する画面。
 *              「前へ」「次へ」で隣のIDの問い合わせに切り替えられる。
 *
 * 主な機能   :
 *   - 問い合わせデータ1件の取得と表示
 *   - 「◀ 前へ」（IDが小さい側で最も近い問い合わせ）・「次へ ▶」（IDが大きい側で最も近い問い合わせ）への移動
 *   - 管理者、または問い合わせた本人にだけ「編集」リンクを表示
 *   - ※表示するとサーバー側で、この問い合わせに関するお知らせ（メインメニューに出る通知）が消される。
 *     ログイン者が問い合わせた本人なら本人宛て、問い合わせ担当者（管理者設定の担当者1〜3）なら担当者宛てが対象
 *
 * 使用API    : GET /api/inquir_detail/<id>/  問い合わせ詳細取得（kosu/views/inquiry_views.py の InquirDetail）
 * 画面URL    : /inquir-detail/:id          （index.tsx のルーティング定義。:id は問い合わせデータのID）
 * 関連ファイル: styles/InquirPage/InquirDetail.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/InquirPage/InquirDetail.module.css";

// ============================================================
// 型定義
// ============================================================

/** 問い合わせデータ1件（レスポンスの inquir_data。画面で使う項目のみ定義） */
interface Inquir {
  employee_no2: number; // 問い合わせ者の従業員番号
  name: string; // 氏名（サーバーでは人員データへの外部キー＝人員データのID が入る）
  content_choice: string; // 内容（"要望" / "不具合" / "問い合わせ"）
  inquiry: string; // 問い合わせ本文
  answer: string; // 回答（未回答なら空文字）
}

/** 人員データ（ログイン者・問い合わせ者の情報。画面で使う項目のみ定義） */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ
  authority: boolean; // 権限
  administrator: boolean; // 管理者（true なら他人の問い合わせでも「編集」リンクを表示）
}

/** GET /api/inquir_detail/<id>/ のレスポンス全体 */
interface Response {
  inquir_data: Inquir; // 表示する問い合わせデータ
  login_data: Member; // ログイン者の人員データ（「編集」リンクを出すかの判定に使う）
  inquir_member_data: Member; // 問い合わせ者の人員データ（氏名の表示に使う）
  next_id: number | null; // 次（IDが大きい側で最も近い）の問い合わせのID。無ければ null
  before_id: number | null; // 前（IDが小さい側で最も近い）の問い合わせのID。無ければ null
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 問い合わせ詳細画面。
 *
 * URL の :id が変わるたびに問い合わせデータを取得し直して表示する。
 *
 * @returns 問い合わせ詳細画面のJSX
 */
const InquirDetail: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<Inquir | null>(null); // 表示する問い合わせデータ（取得前は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  // URL の :id（問い合わせデータのID）を取り出す。params.id と id は同じ値
  const params = useParams<{ id: string }>();
  const { id } = useParams<{ id: string }>();
  const currentId = params.id; // 「編集」リンクのURLに使う
  const [memberData, setMemberData] = useState<Member | null>(null); // ログイン者の人員データ
  const [inquirMemberData, setInquirMemberData] = useState<Member | null>(null); // 問い合わせ者の人員データ
  const [nextId, setNextId] = useState<number | null>(null); // 「次へ」で移動する問い合わせのID（null ならボタン非表示）
  const [beforeId, setBeforeId] = useState<number | null>(null); // 「前へ」で移動する問い合わせのID（null ならボタン非表示）

  // ---------- 副作用（useEffect） ----------

  // URL の :id が変わったとき（初回表示時と「前へ」「次へ」で移動したとき）: 問い合わせデータを取得し直す
  useEffect(() => {
    /**
     * 問い合わせ詳細をサーバーから取得し、各 state に保存する。
     *
     * 401（未ログイン、または問い合わせ者の人員データが無い）ならログイン画面へ、
     * 403（権限なし）ならメインメニューへ遷移する。404（該当IDなし）などはメッセージを表示する。
     *
     * @returns なし（結果は formData などの state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/inquir_detail/<id>/ : 問い合わせデータ・ログイン者・問い合わせ者・前後のIDを取得
        const response = await api.get<Response>(`/api/inquir_detail/${id}/`);
        const { inquir_data, login_data, inquir_member_data, next_id, before_id } = response.data;
        setFormData(inquir_data);
        setMemberData(login_data);
        setInquirMemberData(inquir_member_data);
        setNextId(next_id);
        setBeforeId(before_id);
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
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 「前へ」「次へ」ボタン押下時に、指定IDの問い合わせ詳細画面へ移動する。
   *
   * URL の :id が変わるので、上の useEffect によりデータが取得し直される。
   * useCallback で関数を使い回す（navigate が変わらない限り作り直さない）。
   *
   * @param id - 移動先の問い合わせデータのID。null なら何もしない
   * @returns なし
   */
  const handleNavigate = useCallback((id: number | null) => {
    if (id !== null) navigate(`/inquir-detail/${id}`);
  }, [navigate]);

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // データが取得できなかった場合
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <>
      <div className={styles["inquir-detail-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>問い合わせ詳細</h1>
        {/* 問い合わせ履歴画面へ戻るリンク */}
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-list">問い合わせ履歴</Link>
        </nav>

        {/* 前後の問い合わせへの移動ボタン群 */}
        <div className={styles["pagination-buttons"]}>
          {/* 「前へ」: IDが小さい側に問い合わせがあるときだけ表示 */}
          {beforeId !== null && (
            <button 
              onClick={() => handleNavigate(beforeId)} 
              className="pink_button"
            >
              ◀ 前へ
            </button>
          )}

          {/* 「次へ」: IDが大きい側に問い合わせがあるときだけ表示 */}
          {nextId !== null && (
            <button 
              onClick={() => handleNavigate(nextId)} 
              className="pink_button"
            >
              次へ ▶
            </button>
          )}
        </div>

        {/* 問い合わせの内容表示 */}
        <div className={styles["inquir-content"]}>
          {/* 問い合わせ者（例: 12345：山田太郎） */}
          <h2>問い合わせ者:</h2>
          <p>{formData.employee_no2}：{inquirMemberData?.name}</p>
          {/* 内容（要望 / 不具合 / 問い合わせ） */}
          <h2>内容:</h2>
          <p>{formData.content_choice}</p>
          {/* 問い合わせ本文 */}
          <h2>問い合わせ:</h2>
          <p>{formData.inquiry}</p>
          {/* 回答 */}
          <h2>回答:</h2>
          <p>{formData.answer}</p>
          {/* 「編集」リンク: ログイン者が管理者、または問い合わせた本人のときだけ表示 */}
          {(memberData?.administrator || formData.employee_no2 === memberData?.employee_no) && (
            <Link to={`/inquir-update/${currentId}`} className="pink_button">編集</Link>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default InquirDetail;