/**
 * ============================================================
 * ファイル名 : DefNew.tsx
 * 種別       : 画面コンポーネント（工数区分定義登録画面）
 * 概要       : 新しい工数区分定義Ver（作業カテゴリの定義セット）を登録する画面。管理者のみ利用できる。
 *              Ver名と、最大50個の工数区分（工数区分名・定義・作業内容・変動/固定）を入力して登録する。
 *
 * 主な機能   :
 *   - 表示時に利用可否（ログイン・管理者権限・定義Ver選択済み）を確認
 *   - 工数区分定義Ver名と工数区分1〜50 の入力欄を表示
 *   - 確認ダイアログを出したうえで登録し、成功したら工数区分定義メニューへ戻る
 *
 * 使用API    : GET  /api/def_new/  利用可否の確認（kosu/views/def_views.py の DefNew。レスポンスは未使用）
 *              POST /api/def_new/  工数区分定義の新規登録（同上）
 * 画面URL    : /def-new             （index.tsx のルーティング定義）
 * 関連ファイル: styles/DefinitionPage/DefNew.module.css, Components/Loading.tsx
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
import styles from "../styles/DefinitionPage/DefNew.module.css";

// ============================================================
// 型定義
// ============================================================

/** 工数区分1つ分の入力内容（画面内での持ち方。送信時に kosu_title_N 等の形へ変換する） */
interface KosuDefinition {
  title: string; // 工数区分名（送信時は kosu_title_N）
  division1: string; // 定義（送信時は kosu_division_1_N）
  division2: string; // 作業内容（送信時は kosu_division_2_N）
  division3: boolean; // 変動/固定（送信時は kosu_division_3_N。true: 変動 / false: 固定）
}

/** 登録フォーム全体の入力内容 */
interface FormData {
  kosu_name: string; // 工数区分定義Ver名
  kosu_definitions: KosuDefinition[]; // 工数区分1〜50 の入力内容（配列の0番目が工数区分1）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 工数区分定義登録画面。
 *
 * 表示時に利用可否を確認し、問題なければ空の入力フォーム（工数区分50個分）を表示する。
 * 登録ボタンで確認ダイアログを出し、OKならサーバーへ送信する。
 *
 * @returns 工数区分定義登録画面のJSX
 */
const DefNew: React.FC = () => {
  // ---------- state（画面の状態） ----------

  // 入力フォームの内容。工数区分は50個分の空データで初期化する
  //   （Array(50).fill(null).map(...) で、要素ごとに別々のオブジェクトを作る）
  const [formData, setFormData] = useState<FormData>({
    kosu_name: "",
    kosu_definitions: Array(50).fill(null).map(() => ({ 
      title: "", 
      division1: "", 
      division2: "", 
      division3: false 
    })),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 画面上部に出すエラーメッセージ（null ならエラーなし）
  const [loading, setLoading] = useState(true); // 読み込み中かどうか（true の間はローディング表示）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回だけ）: この画面を使ってよいかをサーバーに確認する
  useEffect(() => {
    /**
     * 工数区分定義登録APIを GET で呼び出し、利用可否を確認する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（管理者でない）ならメニューへ遷移する。
     *
     * @returns なし（エラー時は errorMessage の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/def_new/ : 管理者のログイン者かを確認（レスポンスの中身は使わない）
        await api.get("/api/def_new/");
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 管理者権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。"); // 通信以外の予期しないエラー
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

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

    // 工数区分の欄の場合: 配列をコピーし、該当する1件の該当項目だけを書き換える
    //   （state を直接書き換えると React が変化を検知できないため、新しい配列を作って渡す）
    if (index !== undefined && field) {
      const updatedDefinitions = [...formData.kosu_definitions];
      updatedDefinitions[index] = {
        ...updatedDefinitions[index],
        [field]: value,
      };

      setFormData((prev) => ({
        ...prev,
        kosu_definitions: updatedDefinitions,
      }));
    } else {
      // Ver名の欄の場合: name 属性と同じキーの値を書き換える
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  /**
   * 「登録」ボタン押下（フォーム送信）時の処理。
   *
   * 確認ダイアログでOKが押された場合のみ、入力内容をサーバーが受け取れる形
   * （kosu_title_1〜50 などの平らなキー）に変換して送信する。
   * 成功したら完了メッセージを出して工数区分定義メニューへ戻る。
   *
   * @param event - フォーム送信イベント
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止め、API通信で処理する
    event.preventDefault();
    // 前回のエラー表示を消す
    setErrorMessage(null); 

    // 定義の追加は全人員の工数入力に影響するため、注意を促して最終確認する（キャンセルなら中止）
    const confirmed = window.confirm(
      "工数区分定義を追加すると全人員の工数入力に影響します。課内に変更を展開した上で土日など工数入力がない時間に登録することを推奨します。"
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
      // POST /api/def_new/ : 工数区分定義を新規登録する
      await api.post("/api/def_new/", convertedData);
      // 成功: 完了を知らせて工数区分定義メニューへ戻る
      alert("登録完了！");
      navigate("/def-menu");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: Ver名未入力・Ver名重複・入力チェックNG）: サーバーが返したメッセージを表示
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

  return (
    <>
      {/* ローディング表示（ここでは loading は常に false のため、フェードアウトして1秒後に消える） */}
      <Loading isLoading={loading} />
      <div className={styles["def-new-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>工数区分定義登録</h1>

        {/* 工数区分定義メニュー画面へ戻るリンク */}
        <nav className={styles["def-nav"]}>
          <Link to="/def-menu">工数区分定義MENU</Link>
        </nav>

        {/* エラーメッセージがあるときだけ表示（role="alert" で読み上げソフトにも通知） */}
        {errorMessage && <div role="alert">{errorMessage}</div>}

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
            {/* 登録ボタン（上部。入力欄が長いため上下両方に置いている） */}
            <button type="submit" className="green_button">登録</button>

            {/* 工数区分定義Ver名の入力欄（name="kosu_name" で handleChange が更新先を判断する） */}
            <label htmlFor="kosu_name">工数区分定義Ver名:</label>
            <input
              type="text"
              id="kosu_name"
              name="kosu_name"
              value={formData.kosu_name}
              onChange={handleChange}
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
                        const updatedDefinitions = [...formData.kosu_definitions];
                        updatedDefinitions[index] = {
                          ...updatedDefinitions[index],
                          division3: e.target.checked,
                        };
                        setFormData((prev) => ({
                          ...prev,
                          kosu_definitions: updatedDefinitions,
                        }));
                      }}
                    />
                    {/* スイッチの見た目部分（背景とつまみを CSS で描画する、表示専用の要素） */}
                    <span className={styles["toggle-slider"]}></span>
                  </label>
                </div>
              </div>
            ))}

            {/* 登録ボタン（下部） */}
            <button type="submit" className="green_button">登録</button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default DefNew;