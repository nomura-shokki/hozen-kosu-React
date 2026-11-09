/**
 * ============================================================
 * ファイル名 : TeamNew.tsx
 * 種別       : 画面コンポーネント（班員登録画面）
 * 概要       : ログイン者が管理する班のメンバー（班員）を最大15人まで登録・変更する画面。
 *              あわせて、班員の工数未入力を班員メニューで知らせる「フォロー」のON/OFFを設定する。
 *
 * 主な機能   :
 *   - 登録済みの班員とフォロー設定を読み込み、入力欄の初期値にする
 *   - メンバー1〜15のプルダウンで班員を選択
 *     （選択肢: 組長以上のショップなら全人員、それ以外は自分と同じショップの人員）
 *   - 組長以上のショップのログイン者のみ、ショップ2つまででプルダウンの選択肢を絞り込める
 *   - 「登録」ボタンで保存し、班員メニュー画面へ戻る
 *
 * 使用API    : GET  /api/team_new/  班員登録用データ取得（kosu/views/team_views.py の TeamNew）
 *              POST /api/team_new/  班員データの保存（同上）
 * 画面URL    : /team-new            （index.tsx のルーティング定義）
 * 関連ファイル: styles/TeamPage/TeamNew.module.css,
 *              Components/TeamMemberSelect.tsx, Components/ShopSelect.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/TeamPage/TeamNew.module.css";
import TeamMemberSelect from "../Components/TeamMemberSelect"; // 人員を選ぶプルダウン（"従業員番号 - 氏名" で表示）
import ShopSelect from "../Components/ShopSelect"; // ショップを選ぶプルダウン
import Loading from "../Components/Loading"; // 読み込み中の表示

// ============================================================
// 型定義
// ============================================================

/** 班員登録フォームの入力内容（POST /api/team_new/ の送信データ） */
interface FormData {
  employee_no5: number; // ログイン者（班の管理者）の従業員番号
  member1: string; // メンバー1の従業員番号（プルダウンの値なので文字列。未選択は空文字）
  member2: string; // メンバー2の従業員番号
  member3: string; // メンバー3の従業員番号
  member4: string; // メンバー4の従業員番号
  member5: string; // メンバー5の従業員番号
  member6: string; // メンバー6の従業員番号
  member7: string; // メンバー7の従業員番号
  member8: string; // メンバー8の従業員番号
  member9: string; // メンバー9の従業員番号
  member10: string; // メンバー10の従業員番号
  member11: string; // メンバー11の従業員番号
  member12: string; // メンバー12の従業員番号
  member13: string; // メンバー13の従業員番号
  member14: string; // メンバー14の従業員番号
  member15: string; // メンバー15の従業員番号
  shop1: string; // 選択肢の絞り込み用ショップ1（画面内だけで使用。サーバーでは保存されない）
  shop2: string; // 選択肢の絞り込み用ショップ2（同上）
  follow: boolean; // フォローON/OFF（true なら班員メニューで工数未入力をお知らせする）
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 班員登録画面。
 *
 * 表示時に登録済みの班員・フォロー設定・選択肢用の人員一覧を取得してフォームに反映する。
 * 「登録」押下でサーバーへ保存し、班員メニュー画面へ戻る。
 *
 * @returns 班員登録画面のJSX
 */
const TeamNew: React.FC = () => {
  // ---------- state（画面の状態） ----------
  // フォームの入力内容（初期値はすべて未選択。サーバーからの取得後に上書きする）
  const [formData, setFormData] = useState<FormData>({
    employee_no5: 0,
    member1: "",
    member2: "",
    member3: "",
    member4: "",
    member5: "",
    member6: "",
    member7: "",
    member8: "",
    member9: "",
    member10: "",
    member11: "",
    member12: "",
    member13: "",
    member14: "",
    member15: "",
    shop1: "",
    shop2: "",
    follow: false,
  });

  const [teamMemberOptions, setTeamMemberOptions] = useState<{ employee_no: number; name: string; shop: string }[]>([]); // メンバー選択プルダウンの選択肢（絞り込み前の全件）
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [loggedInShop, setLoggedInShop] = useState<string | null>(null); // ログイン者のショップ（ショップ絞り込み欄を出すかの判定に使う）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中・送信中かどうか（true の間はローディング表示）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回）: 班員登録用データを取得してフォームに反映する
  useEffect(() => {
    /**
     * 班員登録用データをサーバーから取得し、選択肢とフォームの初期値を state に保存する。
     *
     * サーバーはログイン者の班員データがまだなければ空の班員データを新規作成して返す。
     * 401（未ログイン・班員データが複数ある）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
     *
     * @returns なし（結果は teamMemberOptions / loggedInShop / formData / errorMessage の state に反映）
     */
    const fetchData = async () => {
      setLoading(true);
      try {
        // GET /api/team_new/ : 以下をまとめて取得
        //   member_data   : ログイン者の人員データ
        //   team_data     : ログイン者の班員データ（フォロー設定を含む）
        //   member_default: 登録済み班員の人員データ一覧
        //   member_select : プルダウンの選択肢にする人員一覧
        const response = await api.get("/api/team_new/");
        // 選択肢の人員一覧から、プルダウン表示と絞り込みに必要な項目（従業員番号・氏名・ショップ）だけを取り出す
        const memberSelectData =
          response.data.member_select.map(
            (member: { employee_no: number; name: string; shop: string }) => ({
              employee_no: member.employee_no,
              name: member.name,
              shop: member.shop,
            })
          ) ?? [];
        setTeamMemberOptions(memberSelectData);

        // ログイン者の従業員番号・ショップ、登録済み班員、フォロー設定を取り出す
        const loggedInEmployeeNo = response.data.member_data.employee_no;
        const loggedInShop = response.data.member_data.shop;
        setLoggedInShop(loggedInShop);
        const teamDefaultData = response.data.member_default;
        const teamFollow = response.data.team_data.follow;

        // フォームに反映する初期値（ショップ絞り込みは毎回未選択から始める）
        const initialFields: any = { 
          employee_no5: loggedInEmployeeNo, 
          follow: teamFollow,
          shop1: "",
          shop2: "",
        };

        // 登録済み班員を、サーバーから返った順に member1, member2, ... へ前から詰めて設定する
        // （プルダウンの値と比較できるよう従業員番号は文字列に変換）
        teamDefaultData.forEach((member: { employee_no: number }, index: number) => {
          const memberKey = `member${index + 1}` as keyof FormData;
          initialFields[memberKey] = String(member.employee_no);
        });

        setFormData((prevFormData) => {
          // 班員が設定されなかった枠（member1〜15）は未選択（空文字）にする
          for (let i = 1; i <= 15; i++) {
            const memberKey = `member${i}` as keyof FormData;
            if (!initialFields[memberKey]) {
              initialFields[memberKey] = "";
            }
          }

          // 直前の内容に初期値を上書きし、ショップ絞り込みは未選択にする
          return {
            ...prevFormData, 
            ...initialFields,
            shop1: "", 
            shop2: "", 
          };
        });
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、またはログイン者の班員データが複数存在する → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * フォームの各入力欄（プルダウン・チェックボックス）が変更されたときの処理。
   *
   * 入力欄の name 属性と同じ名前の項目を formData に上書きする。
   * チェックボックス（フォローON/OFF）は value ではなく checked（true/false）を保存する。
   *
   * @param event - 入力欄の変更イベント
   * @returns なし（formData の state を更新）
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // name: 項目名（例: "member3"） / value: 選択値 / type: 入力欄の種類
    const { name, value, type } = event.target;

    // チェックボックス: ON/OFF（true/false）を保存する
    if (type === "checkbox") {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    // プルダウン: 選択された値（従業員番号やショップ）を保存する
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  /**
   * 「登録」ボタン押下時の保存処理。
   *
   * フォームの内容をサーバーへ送信し、成功したら班員メニュー画面へ戻る。
   * サーバー側で保存されるのは member1〜member15 と follow だけで、その他の項目は無視される。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // フォーム送信によるページ再読み込みを止め、前回のエラーを消して送信中表示にする
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      // POST /api/team_new/ : ログイン者の班員データ（メンバー1〜15・フォロー設定）を上書き保存
      await api.post("/api/team_new/", formData);
      navigate("/team-menu");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 成功・失敗どちらでも送信中表示を終了する
      setLoading(false);
    }
  };

  // ---------- 描画用の関数・定数 ----------

  /**
   * メンバー1〜15の「ラベル＋人員選択プルダウン」を15組作成する。
   *
   * ショップ絞り込み（shop1 / shop2）が選ばれている場合は、そのどちらかのショップに
   * 所属する人員だけを選択肢にする。どちらも未選択なら全選択肢を表示する。
   *
   * @returns 15組のラベルとプルダウンのJSX配列
   */
  const renderMemberSelects = () => {
    const selects = [];
    // 選択済みの絞り込みショップだけを取り出す（空文字は除外）
    const selectedShops = [formData.shop1, formData.shop2].filter(Boolean);

    // 絞り込みショップが未選択なら全員、選択済みならそのショップの人員だけを選択肢にする
    const filteredMemberOptions = teamMemberOptions.filter((member) =>
      selectedShops.length === 0 || selectedShops.includes(member.shop)
    );

    // メンバー1〜15の枠を順番に作る
    for (let i = 1; i <= 15; i++) {
      // formData の項目名（例: "member1"）と、ラベルとプルダウンを結びつける id
      const memberName = `member${i}` as keyof FormData;
      const memberId = `member-select-${i}`;

      // ラベルとプルダウンを1組にまとめて追加する（key には枠の番号を使う）
      selects.push(
        <React.Fragment key={i}>
          <label htmlFor={memberId}>メンバー{i}:</label>
          <TeamMemberSelect
            id={memberId}
            name={memberName}
            value={formData[memberName] as string}
            onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
            options={filteredMemberOptions}
          />
        </React.Fragment>
      );
    }
    return selects;
  };

  // ショップ絞り込み欄を表示するショップ（組長以上のショップは全人員が選択肢になるため絞り込みを用意する）
  const shopsWithFilter = ["組長以上(P,R,T,その他)", "組長以上(W,A)"];

  // ---------- 描画（JSX） ----------

  // 読み込み中・送信中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // エラー発生時はエラーメッセージだけを出す
  if (errorMessage) return <div>Error: {errorMessage}</div>;

  return (
    <>
      {/* ローディング表示（この位置では loading は常に false のため、フェードアウトして消える） */}
      <Loading isLoading={loading} />
      <div className={styles["team-new-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>班員登録</h1>
        {/* 班員メニュー画面へ戻るリンク */}
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>

        {/* エラーメッセージがあるときだけ表示 */}
        {errorMessage && <div role="alert">{errorMessage}</div>}
        {/* ショップ絞り込み欄: ログイン者が組長以上のショップの場合だけ表示 */}
        {loggedInShop && shopsWithFilter.includes(loggedInShop) && (
          <div className={styles["paling"]}>
            <div className={styles["search-bar"]}>
              <div className={styles["shop-label-wrapper"]}>
                <label>ショップ絞り込み:</label>
              </div>
              {/* 絞り込みショップ1・2のプルダウン（選ぶとメンバー選択肢がそのショップの人員に絞られる） */}
              <div className={styles["shop-select-container"]}>
                <ShopSelect
                  id="shop-select-1"
                  name="shop1"
                  value={formData.shop1}
                  onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
                />
                <ShopSelect
                  id="shop-select-2"
                  name="shop2"
                  value={formData.shop2}
                  onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
                />
              </div>
            </div>
          </div>
        )}

        {/* 班員登録フォーム: 「登録」ボタンで handleSubmit を実行する */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // 入力欄でEnterキーを押してもフォームが送信されないようにし、入力欄からフォーカスを外す
            // （Enterキーでの意図しない送信を防ぎ、「登録」ボタン押下でのみ送信させるため）
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={styles["form-width"]}
        >
          <div className={styles["search-bar"]}>
            {/* フォローON/OFFのトグルスイッチ（見た目はスイッチだが中身はチェックボックス） */}
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="follow-checkbox">フォローON/OFF:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="follow-checkbox"
                  name="follow"
                  checked={formData.follow}
                  onChange={handleChange}
                />
                {/* スイッチのつまみ部分の見た目（CSSで描画） */}
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            {/* メンバー1〜15の人員選択プルダウン */}
            {renderMemberSelects()}

            {/* 登録ボタン */}
            <button type="submit" className="orange_button">
              登録
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default TeamNew;