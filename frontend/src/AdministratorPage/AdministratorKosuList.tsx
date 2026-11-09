/**
 * ============================================================
 * ファイル名 : AdministratorKosuList.tsx
 * 種別       : 画面コンポーネント（全工数管理画面）
 * 概要       : 全人員の工数データを就業日の新しい順に一覧表示する管理者向け画面。
 *              就業日（指定日 / 指定月）・人員・ショップ・直・就業形態・工数入力OK/NG判定で絞り込みができる。
 *
 * 主な機能   :
 *   - 全人員の工数データ一覧の取得と表示（ページネーション付き）
 *   - 検索条件を変更するとすぐに絞り込み検索（日付は「指定月」「指定日」ボタンで検索単位を切り替え）
 *   - 人員の選択肢は「工数データがある人員」（ショップ指定時はそのショップの人員のみ）
 *   - 各行の「編集」リンクから全工数編集画面へ遷移
 *
 * 使用API    : GET /api/manager_kosu/  全工数一覧取得（kosu/views/main_views.py の AdministratorKosuList）
 * 画面URL    : /manager-kosu            （index.tsx のルーティング定義）
 * 関連ファイル: styles/AdministratorPage/AdministratorKosuList.module.css,
 *              Components/TeamMemberSelect.tsx, Components/ShopSelect.tsx, Components/TyokuSelect.tsx,
 *              Components/WorkSelect.tsx, Components/JudgementSelect.tsx,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx,
 *              AdministratorPage/AdministratorKosuUpdate.tsx（編集画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import TeamMemberSelect from "../Components/TeamMemberSelect"; // 人員の選択プルダウン（「従業員番号 - 氏名」で表示）
import ShopSelect from "../Components/ShopSelect"; // ショップの選択プルダウン
import TyokuSelect from "../Components/TyokuSelect"; // 直の選択プルダウン
import WorkSelect from "../Components/WorkSelect"; // 就業形態の選択プルダウン
import JudgementSelect from "../Components/JudgementSelect"; // 工数入力OK/NG判定の選択プルダウン
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/AdministratorPage/AdministratorKosuList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 全工数一覧の1行分のデータ（GET /api/manager_kosu/ のレスポンス kosu_data.results の要素） */
interface Kosu {
  id: number; // 工数データのID（主キー）。編集画面のURLに使う
  employee_no3: number; // 従業員番号
  name: string; // 氏名（APIからは人員データのIDが届くが、画面側で氏名に置き換える）
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"。formatTyoku で表示名に変換する）
  work_time: string; // 就業形態（出勤・休日出勤・年休 など）
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
}

/** 人員の選択肢1件分（GET /api/manager_kosu/ のレスポンス member_data の要素） */
interface KosuMember {
  id: number; // 人員データのID（主キー）
  employee_no: number; // 従業員番号
  name: string; // 氏名
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 直の番号を画面表示用の名称に変換する。
 *
 * @param value - 直の番号（文字列 "1" でも数値 1 でも可）
 * @returns 直の名称（例: 1 → "1直"、4 → "常昼"）。該当しない値は空文字
 */
const formatTyoku = (value: string | number): string => {
  // 文字列で渡されても比較できるよう数値に変換してから判定する
  switch (Number(value)) {
    case 1: return "1直";
    case 2: return "2直";
    case 3: return "3直";
    case 4: return "常昼";
    case 5: return "連1直";
    case 6: return "連2直";
    default: return "";
  }
};

/**
 * 日付文字列から曜日（漢字1文字）を求める。
 *
 * @param dateStr - 日付文字列（"YYYY-MM-DD"）
 * @returns 曜日（"日"〜"土"）。日付として解釈できない場合は空文字
 */
const getDayOfWeek = (dateStr: string): string => {
  // Date.getDay() の戻り値（0=日曜〜6=土曜）の順に並べた曜日表
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr);
  // 不正な日付だと getDay() が NaN になり undefined となるため、空文字で代用する
  return days[date.getDay()] || "";
};

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 全工数管理画面。
 *
 * 表示時に1ページ目の全工数データを取得し、表形式で表示する。
 * 検索欄のいずれかの条件を変更すると、1ページ目に戻してその条件で取得し直す。
 *
 * @returns 全工数管理画面のJSX
 */
const AdministratorKosuList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Kosu[]>([]); // 表に表示する工数データ（現在のページ分）
  const [MemberOptions, setMemberOptions] = useState<KosuMember[]>([]); // 人員プルダウンの選択肢
  const [selectedMemberInput, setSelectedMemberInput] = useState<string>(""); // 選択中の人員の従業員番号（空文字なら指定なし）
  const [searchShop, setSearchShop] = useState<string>(""); // 選択中のショップ（空文字なら指定なし）
  const [searchTyoku, setSearchTyoku] = useState<string>(""); // 選択中の直の番号（空文字なら指定なし）
  const [searchWork, setSearchWork] = useState<string>(""); // 選択中の就業形態（空文字なら指定なし）
  const [searchJudgement, setSearchJudgement] = useState<string>(""); // 選択中の工数入力OK/NG判定（"OK" / "NG" / 空文字）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [searchDay, setSearchDay] = useState<string>(""); // 検索欄で選択中の日付（"YYYY-MM-DD"。空文字なら絞り込みなし）
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false); // true: 月単位で検索 / false: 日単位で検索
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 全工数データ一覧をサーバーから取得し、state に保存する。
   *
   * 検索条件が1つでも指定されている場合のみ絞り込み用のパラメータを付けて送信する。
   * あわせて人員の選択肢を受け取り、各行の氏名を従業員番号から引いて置き換える。
   * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（管理者権限なし）ならメインメニューへ遷移する。
   * useEffect の依存配列に入れるため、useCallback で関数を使い回す（毎回作り直さない）。
   *
   * @param page      - 取得するページ番号（1始まり）
   * @param day       - 検索日（"YYYY-MM-DD"）。空文字なら日付で絞り込まない
   * @param mode      - true: 月単位で検索 / false: 日単位で検索
   * @param member    - 人員の従業員番号。空文字なら指定なし
   * @param shop      - ショップ。空文字なら指定なし
   * @param tyoku     - 直の番号。空文字なら指定なし
   * @param work      - 就業形態。空文字なら指定なし
   * @param judgement - 工数入力OK/NG判定（"OK" / "NG"）。空文字なら指定なし
   * @returns なし（結果は data / totalPages / MemberOptions / error の state に反映）
   */
  const fetchData = useCallback(async (
    page: number,
    day: string,
    mode: boolean,
    member: string,
    shop: string,
    tyoku: string,
    work: string,
    judgement: string,
  ) => {
    setLoading(true);
    try {
      // GET /api/manager_kosu/ : 全人員の工数一覧を取得
      const response = await api.get("/api/manager_kosu/", {
        params: {
          page: page,
          // 検索条件が1つでもある場合だけ、絞り込み用のパラメータをまとめて追加する
          //   day / mode: 就業日での絞り込み（"month"=同じ年月すべて / "day"=その日のみ）
          //   filter    : "true" のときだけサーバー側で日付の絞り込みが行われる
          //   member / shop / tyoku / work / judgement: 各項目の完全一致で絞り込み（空文字は無視される）
          //   ※shop は工数データの項目ではなく、人員データのショップが一致する人の工数に絞り込む
          ...(day || member || shop || tyoku || work || judgement ? {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
            member: member,
            shop: shop,
            tyoku: tyoku,
            work: work,
            judgement: judgement,
          } : {}),
        }
      });

      // kosu_data の中に count / page_size / results（現在ページのデータ）が入っている
      const kosuData = response.data?.kosu_data || {};
      const results = kosuData.results || [];
      // page_size: 1ページの件数（管理者設定の一覧表示項目数）。取得できなければ20件とみなす
      const pageSize = kosuData.page_size || 20;
      // 人員の選択肢（工数データがある人員。ショップ指定時はそのショップの人員のみ）
      const memberOptions = response.data?.member_data || [];

      // 従業員番号 → 氏名 の対応表を作る（例: { 12345: "山田太郎" }）
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: KosuMember) => {
        memberNameMap[member.employee_no] = member.name;
      });
      // 各行の name を氏名に置き換える（見つからない場合は "Unknown (従業員番号)"）
      const transformedData = results.map((item: Kosu) => ({
        ...item,
        name: memberNameMap[item.employee_no3] || `Unknown (${item.employee_no3})`,
      }));

      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(kosuData.count / pageSize));
      setData(transformedData);
      setMemberOptions(memberOptions);
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 管理者権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他: サーバーが返したメッセージを表示
        else setError(err.response?.data.message);
      } else {
        // 通信以外の予期しないエラー
        setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    } finally {
      // 成功・失敗どちらでも読み込み中表示を終了する
      setLoading(false);
    }
  }, [navigate]);

  // ---------- 副作用（useEffect） ----------

  // ページ番号・検索日・検索モード・各検索条件のいずれかが変わったとき:
  // その条件で一覧を取得し直す（初回表示時も実行される）
  useEffect(() => {
    fetchData(
      currentPage,
      searchDay,
      searchByMonth,
      selectedMemberInput,
      searchShop,
      searchTyoku,
      searchWork,
      searchJudgement
    );
  }, [
    currentPage,
    fetchData,
    searchDay,
    searchByMonth,
    selectedMemberInput,
    searchShop,
    searchTyoku,
    searchWork,
    searchJudgement
  ]);

  // ---------- イベントハンドラ ----------

  /**
   * 検索欄の各入力の変更に共通する処理。
   *
   * 入力値を指定された state に保存し、1ページ目に戻す。
   * 一覧の再取得は、state の変化をきっかけに useEffect が行う。
   *
   * @param setter - 値を保存する state の更新関数（setSearchShop など）
   * @param event  - 入力欄・プルダウンの変更イベント
   * @returns なし
   */
  const handleGenericChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const newValue = event.target.value;
    setter(newValue);
    setCurrentPage(1);
  };

  /**
   * 日付入力欄の変更時の処理（検索日を保存して1ページ目へ）。
   *
   * @param e - 日付入力欄の変更イベント
   * @returns なし
   */
  const handleSearchDayChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleGenericChange(setSearchDay, e);
  };

  /**
   * 人員プルダウンの変更時の処理（選択した従業員番号を保存して1ページ目へ）。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSelectedMemberInput, event);
  };

  /**
   * ショッププルダウンの変更時の処理（選択したショップを保存して1ページ目へ）。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleShopChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchShop, event);
  };

  /**
   * 直プルダウンの変更時の処理（選択した直の番号を保存して1ページ目へ）。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleTyokuChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchTyoku, event);
  };

  /**
   * 就業形態プルダウンの変更時の処理（選択した就業形態を保存して1ページ目へ）。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleWorkChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchWork, event);
  };

  /**
   * 工数入力OK/NG判定プルダウンの変更時の処理（選択した値を保存して1ページ目へ）。
   *
   * @param event - プルダウンの変更イベント
   * @returns なし
   */
  const handleJudgementChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleGenericChange(setSearchJudgement, event);
  };

  /**
   * 「指定月」「指定日」ボタン押下時の処理。
   *
   * 検索モードを保存して1ページ目に戻す。一覧の再取得は useEffect が行う
   * （モード・ページ番号がすでに同じ値の場合は state が変わらないため再取得されない）。
   *
   * @param isMonthSearch - true: 指定月で検索 / false: 指定日で検索
   * @returns なし
   */
  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["admin-kosu-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          全工数管理
        </h1>

        {/* 管理者メニュー画面へ戻るリンク */}
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

        {/* 検索欄: いずれかの条件を変更するとすぐに検索される */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          {/* 1行目: 就業日と検索単位（指定月 / 指定日）の切り替えボタン */}
          <div className={styles["row-group"]}>
            <div className={styles["form-group"]}>
              <label htmlFor="searchDayInput">就業日：</label>
              <input
                type="date"
                id="searchDayInput"
                value={searchDay}
                onChange={handleSearchDayChange}
                placeholder="日付を選択"
              />
            </div>
            {/* 選択した日付と同じ年月のデータをすべて表示 */}
            <button onClick={() => handleSearch(true)} className="gray_button">
              指定月
            </button>
            {/* 選択した日付のデータのみ表示 */}
            <button onClick={() => handleSearch(false)} className="gray_button">
              指定日
            </button>
          </div>

          {/* 2行目: 人員とショップ */}
          <div className={styles["row-group"]}>
            {/* 人員の選択（選択肢はサーバーから受け取った MemberOptions） */}
            <div className={styles["form-group"]}>
              <label htmlFor="team-member-select">人員：</label>
              <TeamMemberSelect
                id="team-member-select"
                name="team-member-select"
                value={selectedMemberInput}
                onChange={handleMemberChange}
                options={MemberOptions}
              />
            </div>
            {/* ショップの選択 */}
            <div className={styles["form-group"]}>
              <label htmlFor="shopFilter">ショップ：</label>
              <ShopSelect
                id="shopFilter"
                name="shopFilter"
                value={searchShop}
                onChange={handleShopChange}
              />
            </div>
          </div>

          {/* 3行目: 直と就業形態 */}
          <div className={styles["row-group"]}>
            {/* 直の選択 */}
            <div className={styles["form-group"]}>
              <label htmlFor="tyokuFilter">直：</label>
              <TyokuSelect
                id="tyokuFilter"
                value={searchTyoku}
                onChange={handleTyokuChange}
              />
            </div>
            {/* 就業形態の選択（mode="ALL": 休日・年休などを含むすべての就業形態を選択肢にする） */}
            <div className={styles["form-group"]}>
              <label htmlFor="workFilter">勤務形態：</label>
              <WorkSelect
                id="workFilter"
                value={searchWork}
                onChange={handleWorkChange}
                mode="ALL"
              />
            </div>
          </div>

          {/* 4行目: 工数入力OK/NG判定 */}
          <div className={styles["row-group"]}>
            <div className={styles["form-group"]}>
              <label htmlFor="JudgementSelect">整合性:</label>
              <JudgementSelect
                id="JudgementSelect"
                name="JudgementSelect"
                value={searchJudgement}
                onChange={handleJudgementChange}
              />
            </div>
          </div>
        </div>

        {/* データが0件ならメッセージ、1件以上なら一覧表を表示 */}
        {data.length === 0 ? (
          <p>No data found.</p>
        ) : (
          // 表の外枠（heightExpansion: 検索欄の高さを引かず、画面の高さ − 100px を最大高さにする）
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
            heightExpansion
          >
            <table>
              {/* 表の見出し行 */}
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>氏名</th>
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>勤務形態</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>編集</th>
                </tr>
              </thead>
              {/* 表の本体: 工数データ1件につき1行を表示（key には工数データのIDを使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    {/* 氏名 */}
                    <td>{item.name}</td>
                    {/* 就業日と曜日（例: 2026-11-09 (月)） */}
                    <td>{item.work_day2} ({getDayOfWeek(item.work_day2)})</td>
                    {/* 直の名称 */}
                    <td>{formatTyoku(item.tyoku2)}</td>
                    {/* 就業形態 */}
                    <td>{item.work_time}</td>
                    {/* 整合性: 工数入力OK/NG判定に応じて文字と色を切り替える */}
                    <td className={item.judgement ? styles["status-ok"] : styles["status-ng"]}>
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    {/* 全工数編集画面へのリンク（URLに工数データのIDを含める） */}
                    <td>
                      <Link
                        to={`/manager-kosu-update/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        編集
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ページ切り替えボタン（押すと currentPage が変わり、useEffect で再取得される） */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              buttonColor="#656565"
              hoverColor="#3a3a3a"
            />
          </TableContainer>
        )}
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default AdministratorKosuList;