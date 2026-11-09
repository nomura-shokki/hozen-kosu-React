/**
 * ============================================================
 * ファイル名 : MemberEdit.tsx
 * 種別       : 画面コンポーネント（人員編集画面）
 * 概要       : 登録済みの人員（従業員）1人分のデータを編集する画面。権限ありの人員のみ利用できる。
 *              従業員番号・氏名・ショップ・権限・管理者権限を変更して更新する。
 *
 * 主な機能   :
 *   - URLの従業員番号に対応する人員データを取得し、入力欄に初期表示
 *   - 従業員番号・氏名・ショップの編集、権限・管理者権限のON/OFF切り替え
 *   - 更新し、成功したら人員一覧へ戻る（画面に表示しない項目も取得した値のまま送り返す）
 *
 * 使用API    : GET /api/member_update/<従業員番号>/  人員データ1件の取得
 *                                                    （kosu/views/member_views.py の MemberUpdate）
 *              PUT /api/member_update/<従業員番号>/  人員データ1件の更新（同上）
 * 画面URL    : /member-update/:employee_no           （index.tsx のルーティング定義）
 * 関連ファイル: styles/MemberPage/MemberEdit.module.css, Components/ShopSelect.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import ShopSelect from "../Components/ShopSelect"; // ショップを選ぶプルダウン
import styles from "../styles/MemberPage/MemberEdit.module.css"; 

// ============================================================
// 型定義
// ============================================================

/**
 * 人員データ1人分（GET /api/member_update/<従業員番号>/ のレスポンス。PUT の送信データにもなる）。
 *
 * 休憩時間（break_time〜）は "#HHMMHHMM" 形式（開始時刻と終了時刻）。
 * 番号は直を表す（1=1直, 2=2直, 3=3直, 4=常昼, 5=連1直, 6=連2直）。
 * この画面では休憩時間・お知らせ枠は編集せず、取得した値をそのまま送り返す。
 */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（true: 人員・班員の管理画面を使える）
  administrator: boolean; // 管理者（true: 管理者・工数区分定義の編集画面を使える）
  break_time1: string; // 1直の昼休憩時間
  break_time1_over1: string; // 1直の残業休憩時間1
  break_time1_over2: string; // 1直の残業休憩時間2
  break_time1_over3: string; // 1直の残業休憩時間3
  break_time2: string; // 2直の昼休憩時間
  break_time2_over1: string; // 2直の残業休憩時間1
  break_time2_over2: string; // 2直の残業休憩時間2
  break_time2_over3: string; // 2直の残業休憩時間3
  break_time3: string; // 3直の昼休憩時間
  break_time3_over1: string; // 3直の残業休憩時間1
  break_time3_over2: string; // 3直の残業休憩時間2
  break_time3_over3: string; // 3直の残業休憩時間3
  break_time4: string; // 常昼の昼休憩時間
  break_time4_over1: string; // 常昼の残業休憩時間1
  break_time4_over2: string; // 常昼の残業休憩時間2
  break_time4_over3: string; // 常昼の残業休憩時間3
  break_time5: string; // 連1直の昼休憩時間
  break_time5_over1: string; // 連1直の残業休憩時間1
  break_time5_over2: string; // 連1直の残業休憩時間2
  break_time5_over3: string; // 連1直の残業休憩時間3
  break_time6: string; // 連2直の昼休憩時間
  break_time6_over1: string; // 連2直の残業休憩時間1
  break_time6_over2: string; // 連2直の残業休憩時間2
  break_time6_over3: string; // 連2直の残業休憩時間3
  pop_up1: string; // お知らせ1の文言（自分の問い合わせに回答が付いたときに入る）
  pop_up_id1: string; // お知らせ1の対象の問い合わせID
  pop_up2: string; // お知らせ2の文言
  pop_up_id2: string; // お知らせ2の対象の問い合わせID
  pop_up3: string; // お知らせ3の文言
  pop_up_id3: string; // お知らせ3の対象の問い合わせID
  pop_up4: string; // お知らせ4の文言
  pop_up_id4: string; // お知らせ4の対象の問い合わせID
  pop_up5: string; // お知らせ5の文言
  pop_up_id5: string; // お知らせ5の対象の問い合わせID
  break_check: boolean; // 休憩エラー有効チェック
  def_prediction: boolean; // ※人員モデル（models.py の member）には現在この項目はなく、レスポンスにも含まれない
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 人員編集画面。
 *
 * 表示時にURLの従業員番号で人員データを取得して入力欄に表示し、更新ボタンでサーバーへ送信する。
 *
 * @returns 人員編集画面のJSX
 */
const MemberEdit: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const { employee_no } = useParams<{ employee_no: string }>(); // URLの :employee_no 部分（編集対象の従業員番号。文字列）
  const employeeNo = Number(employee_no); // URLの従業員番号を数値に変換したもの（APIのURLに使う）
  const [formData, setFormData] = useState<Member | null>(null); // 入力フォームの内容（取得前・取得失敗時は null）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLの従業員番号が変わったとき: 編集対象の人員データを取得して入力欄に反映する
  useEffect(() => {
    /**
     * 人員データ1人分をサーバーから取得し、state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（結果は formData / errorMessage の state に反映）
     */
    const fetchMember = async () => {
      try {
        // GET /api/member_update/<従業員番号>/ : 編集対象の人員データを取得
        const response = await api.get<Member>(`/api/member_update/${employeeNo}/`);
        setFormData(response.data);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし（人員の「権限」が付いていない） → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 該当する人員なし など）: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchMember();
  }, [employeeNo, navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 入力欄・プルダウン・チェックボックスの変更時の処理。
   *
   * 入力欄の name 属性（例: "name"、"authority"）と同じ名前の項目を更新する。
   * チェックボックス（権限・管理者権限）はチェック状態（true/false）を、それ以外は入力値を入れる。
   *
   * @param event - 入力欄・プルダウン・チェックボックスの変更イベント
   * @returns なし（formData の state に反映）
   */
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;

    // チェックボックス: checked（true/false）を保存する
    if (type === "checkbox") {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => {
        // データ未取得（null）の場合は何も変えない
        if (!prev) return prev;
        return {
          ...prev,
          [name]: checked,
        };
      });
    } else {
      // テキスト・数値入力・プルダウン: 入力値（文字列）をそのまま保存する
      setFormData((prev) => {
        // データ未取得（null）の場合は何も変えない
        if (!prev) return prev;
        return {
          ...prev,
          [name]: value,
        };
      });
    }
  };

  /**
   * 「更新」ボタン押下（フォーム送信）時の処理。
   *
   * 取得した人員データ（編集内容を反映したもの）を丸ごとサーバーへ送り、
   * 成功したら完了メッセージを出して人員一覧へ戻る。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();

    try {
      // PUT /api/member_update/<従業員番号>/ : 人員データを更新する
      //   URLには変更前の従業員番号を使い、従業員番号の変更後の値は formData 側で送る
      await api.put(`/api/member_update/${employeeNo}/`, formData);
      // 成功: 完了を知らせて人員一覧へ戻る
      alert("データが更新されました！");
      navigate("/member-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // その他（404: 該当なし / 400: 従業員番号の重複・入力チェックNG など）: サーバーが返したメッセージを表示
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
      <div className={styles["member-edit-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>人員データ編集</h1>
        {/* 人員一覧画面へ戻るリンク */}
        <nav className={styles["member-nav"]}>
          <Link to="/member-list">人員一覧</Link>
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
            {/* 従業員番号の入力欄（数値入力。変更すると従業員番号自体が書き換わる） */}
            <label htmlFor="employee_no">従業員番号:</label>
            <input
              type="number"
              id="employee_no"
              name="employee_no"
              value={formData.employee_no}
              onChange={handleChange}
            />

            {/* 氏名の入力欄 */}
            <label htmlFor="name">氏名:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />

            {/* ショップのプルダウン */}
            <label htmlFor="shop">ショップ:</label>
            <ShopSelect
              name="shop"
              value={formData.shop}
              onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
            />

            {/* 権限の切り替えスイッチ（チェックボックスを CSS でトグルスイッチ風に見せる） */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="authority">権限:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="authority"
                  name="authority"
                  checked={formData.authority}
                  onChange={handleChange}
                />
                {/* スイッチの見た目部分（背景とつまみを CSS で描画する、表示専用の要素） */}
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            {/* 管理者権限の切り替えスイッチ（チェックボックスを CSS でトグルスイッチ風に見せる） */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="administrator">管理者権限:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="administrator"
                  name="administrator"
                  checked={formData.administrator}
                  onChange={handleChange}
                />
                {/* スイッチの見た目部分（背景とつまみを CSS で描画する、表示専用の要素） */}
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
            {/* 更新ボタン */}
            <button type="submit" className="yellow_button">更新</button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default MemberEdit;