/**
 * ============================================================
 * ファイル名 : DefEdit.tsx
 * 種別       : 画面コンポーネント（工数区分定義編集画面）
 * 概要       : 登録済みの工数区分定義Ver（作業カテゴリの定義セット）1件の内容を編集する画面。
 *              管理者のみ利用できる。Ver名と工数区分1〜50 の内容を書き換えて更新する。
 *
 * 主な機能   :
 *   - URLのIDに対応する工数区分定義を取得し、入力欄に初期表示
 *   - 工数区分名・定義・作業内容・変動/固定の編集
 *   - 確認ダイアログを出したうえで更新し、成功したら工数区分定義一覧へ戻る
 *
 * 使用API    : GET /api/def_update/<id>/  工数区分定義1件の取得（kosu/views/def_views.py の DefUpdate）
 *              PUT /api/def_update/<id>/  工数区分定義1件の更新（同上）
 * 画面URL    : /def-update/:id             （index.tsx のルーティング定義。:id は工数区分定義のID）
 * 関連ファイル: styles/DefinitionPage/DefEdit.module.css, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate, useParams } from "react-router-dom";
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/DefinitionPage/DefEdit.module.css";


// ============================================================
// 型定義
// ============================================================

/** 工数区分1つ分の入力内容（画面内での持ち方。送受信時は kosu_title_N 等の形と相互変換する） */
interface KosuDefinition {
  title: string; // 工数区分名（サーバー側は kosu_title_N）
  division1: string; // 定義（サーバー側は kosu_division_1_N）
  division2: string; // 作業内容（サーバー側は kosu_division_2_N）
  division3: boolean; // 変動/固定（サーバー側は kosu_division_3_N。true: 変動 / false: 固定）
}

/** 編集フォーム全体の入力内容 */
interface FormData {
  kosu_name: string; // 工数区分定義Ver名
  kosu_definitions: KosuDefinition[]; // 工数区分1〜50 の入力内容（配列の0番目が工数区分1）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義編集画面。
 *
 * 表示時にURLのIDで工数区分定義を取得し、画面用の形（50個の配列）に変換して入力欄に表示する。
 * 更新ボタンで確認ダイアログを出し、OKならサーバー用の形に戻して送信する。
 *
 * @returns 工数区分定義編集画面のJSX
 */
const DefEdit: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const { id } = useParams<{ id: string }>(); // URLの :id 部分（編集対象の工数区分定義のID）
  const navigate = useNavigate(); // 画面遷移用の関数
  const [formData, setFormData] = useState<FormData | null>(null); // 入力フォームの内容（取得前・取得失敗時は null）
  const [loading, setLoading] = useState(true); // 読み込み中かどうか（true の間はローディング表示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 画面上部に出すエラーメッセージ（null ならエラーなし）

  // ---------- 副作用（useEffect） ----------

  // 初回表示時・URLのIDが変わったとき: 編集対象の工数区分定義を取得して入力欄に反映する
  useEffect(() => {
    /**
     * 工数区分定義1件をサーバーから取得し、画面用の形に変換して state に保存する。
     *
     * 401（未ログイン）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
     *
     * @returns なし（結果は formData / errorMessage の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/def_update/<id>/ : 編集対象の工数区分定義1件を取得
        const response = await api.get(`/api/def_update/${id}/`);
        const rawData = response.data;
        // kosu_title_1〜50 などの平らなキーを、工数区分ごとのオブジェクト50個の配列に変換する
        //   未入力（null）の項目は空文字に、変動/固定は true または "true" のときだけ true にする
        const kosu_definitions = Array.from({ length: 50 }, (_, i) => {
          const idx = i + 1; // 工数区分の番号（1始まり）
          return {
            title: rawData[`kosu_title_${idx}`] || "",
            division1: rawData[`kosu_division_1_${idx}`] || "",
            division2: rawData[`kosu_division_2_${idx}`] || "",
            division3: rawData[`kosu_division_3_${idx}`] === true || rawData[`kosu_division_3_${idx}`] === "true",
          };
        });

        setFormData({ kosu_name: rawData.kosu_name || "", kosu_definitions });
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他（404: 該当データなし など）: サーバーが返したメッセージを保存
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * テキスト入力欄の変更時の処理。Ver名の欄と、各工数区分の欄で共用する。
   *
   * index と field が渡された場合は「工数区分 index 番目の field 項目」を更新し、
   * 渡されない場合は入力欄の name 属性（例: "kosu_name"）と同じ名前の項目を更新する。
   *
   * @param event - 入力欄の変更イベント
   * @param index - 工数区分の配列番号（0始まり。工数区分1 なら 0）。Ver名の欄では省略
   * @param field - 更新する項目名（"title" / "division1" / "division2"）。Ver名の欄では省略
   * @returns なし（formData の state に反映）
   */
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof KosuDefinition
  ) => {
    const { name, value } = event.target;
    // データ未取得の場合は何もしない
    if (!formData) return;

    // 工数区分の欄の場合: 配列をコピーし、該当する1件の該当項目だけを書き換える
    //   （state を直接書き換えると React が変化を検知できないため、新しい配列を作って渡す）
    if (index !== undefined && field) {
      const updated = [...formData.kosu_definitions];
      updated[index] = { ...updated[index], [field]: value };
      setFormData({ ...formData, kosu_definitions: updated });
    } else {
      // Ver名の欄の場合: name 属性と同じキーの値を書き換える
      setFormData({ ...formData, [name]: value });
    }
  };

  /**
   * 「更新」ボタン押下（フォーム送信）時の処理。
   *
   * 確認ダイアログでOKが押された場合のみ、入力内容をサーバーが受け取れる形
   * （kosu_title_1〜50 などの平らなキー）に変換して送信する。
   * 成功したら完了メッセージを出して工数区分定義一覧へ戻る。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();
    // データ未取得の場合は何もしない
    if (!formData) return;

    // 定義の更新は全人員の工数入力に影響するため、注意を促して最終確認する（キャンセルなら中止）
    const confirmed = window.confirm(
      "工数区分定義を更新すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
    );
    if (!confirmed) return;

    // 送信用データ: サーバー側のモデル（kosu_division）の項目名に合わせた平らなオブジェクト
    const convertedData: { [key: string]: string | boolean } = {
      kosu_name: formData.kosu_name,
    };

    // 工数区分の配列を「項目名_番号」のキーに展開する
    //   例: 配列0番目の title → kosu_title_1、division1 → kosu_division_1_1
    formData.kosu_definitions.forEach((def, index) => {
      const idx = index + 1; // 工数区分の番号（1始まり）
      convertedData[`kosu_title_${idx}`] = def.title;
      convertedData[`kosu_division_1_${idx}`] = def.division1;
      convertedData[`kosu_division_2_${idx}`] = def.division2;
      convertedData[`kosu_division_3_${idx}`] = def.division3;
    });

    try {
      // PUT /api/def_update/<id>/ : 工数区分定義1件を更新する
      await api.put(`/api/def_update/${id}/`, convertedData);
      // 成功: 完了を知らせて工数区分定義一覧へ戻る
      alert("更新完了！");
      navigate("/def-list");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（404: 該当データなし / 400: Ver名重複・入力チェックNG）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
    } finally {
      // 念のため読み込み中表示を解除する（この時点で既に false）
      setLoading(false);
    }
  };

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // データを取得できなかった場合（404 などのエラー時を含む）はメッセージだけを出す
  if (!formData || !formData.kosu_definitions) return <div>データが見つかりません</div>;

  return (
    <>
      {/* ローディング表示（ここでは loading は常に false のため、フェードアウトして1秒後に消える） */}
      <Loading isLoading={loading} />
      <div className={styles["def-edit-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数区分定義編集</h1>
        {/* 工数区分定義一覧画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-list">工数区分定義一覧</Link>
        </nav>

        {/* エラーメッセージがあるときだけ表示（role="alert" で読み上げソフトにも通知） */}
        {errorMessage && <div role="alert">{errorMessage}</div>}

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
            {/* 更新ボタン（上部。入力欄が長いため上下両方に置いている） */}
            <button type="submit" className="green_button">更新</button>

            {/* 工数区分定義Ver名の入力欄（name="kosu_name" で handleChange が更新先を判断する） */}
            <label htmlFor="kosu_name">工数区分定義Ver名:</label>
            <input
              type="text"
              id="kosu_name"
              name="kosu_name"
              value={formData.kosu_name}
              onChange={(e) => handleChange(e)}
            />

            {/* 工数区分1〜50 の入力ブロックを1つずつ表示（key には配列の番号を使う） */}
            {formData.kosu_definitions.map((def, index) => (
              <div key={index} className={styles["definition-block"]}>
                {/* 工数区分名の入力欄 */}
                <label htmlFor={`kosu_title_${index + 1}`}>{`工数区分名${index + 1}:`}</label>
                <input
                  type="text"
                  id={`kosu_title_${index + 1}`}
                  value={def.title}
                  onChange={(e) => handleChange(e, index, "title")}
                />

                {/* 定義の入力欄（3行のテキストエリア） */}
                <label htmlFor={`kosu_division_${index + 1}_1`}>{`定義${index + 1}:`}</label>
                <textarea
                  id={`kosu_division_${index + 1}_1`}
                  value={def.division1}
                  onChange={(e) => handleChange(e, index, "division1")}
                  rows={3}
                />

                {/* 作業内容の入力欄（3行のテキストエリア） */}
                <label htmlFor={`kosu_division_${index + 1}_2`}>{`作業内容${index + 1}:`}</label>
                <textarea
                  id={`kosu_division_${index + 1}_2`}
                  value={def.division2}
                  onChange={(e) => handleChange(e, index, "division2")}
                  rows={3}
                />

                {/* 変動/固定の切り替えスイッチ（ON: 変動 / OFF: 固定） */}
                <div className={styles["switch-wrapper"]}>
                  <label htmlFor={`kosu_division_${index + 1}_3`}>{`変動/固定${index + 1}:`}</label>
                  {/* チェックボックスを CSS でトグルスイッチ風に見せる。
                      チェック状態が変わったら、該当する工数区分の division3 だけを書き換える */}
                  <label className={styles["toggle-switch"]}>
                    <input
                      type="checkbox"
                      id={`kosu_division_${index + 1}_3`}
                      name={`kosu_division_${index + 1}_3`}
                      checked={def.division3}
                      onChange={(e) => {
                        const updated = [...formData.kosu_definitions];
                        updated[index] = { ...updated[index], division3: e.target.checked };
                        setFormData({ ...formData, kosu_definitions: updated });
                      }}
                    />
                    {/* スイッチの見た目部分（背景とつまみを CSS で描画する、表示専用の要素） */}
                    <span className={styles["toggle-slider"]}></span>
                  </label>
                </div>
              </div>
            ))}

            {/* 更新ボタン（下部） */}
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
export default DefEdit;