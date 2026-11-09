/**
 * ============================================================
 * ファイル名 : TeamList.tsx
 * 種別       : 画面コンポーネント（班員工数履歴画面）
 * 概要       : ログイン者が登録した班員全員の工数データを、就業日の新しい順に一覧表示する画面。
 *              日付を1つ選んで「指定日」または「指定月」で絞り込みができ、班員1人に絞ることもできる。
 *
 * 主な機能   :
 *   - 班員の工数データ一覧の取得と表示（ページネーション付き）
 *   - 指定日 / 指定月 での絞り込み検索
 *   - 班員プルダウンでの班員1人への絞り込み
 *   - 各行の「詳細」リンクから班員工数詳細画面へ遷移
 *   - 班員が未登録の場合は班員メニュー画面へ戻してメッセージを表示
 *
 * 使用API    : GET /api/team_list/  班員の工数一覧取得（kosu/views/team_views.py の TeamList）
 * 画面URL    : /team-list            （index.tsx のルーティング定義）
 * 関連ファイル: styles/TeamPage/TeamList.module.css, Components/TeamMemberSelect.tsx,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx,
 *              TeamPage/TeamDetail.tsx（詳細画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate, useLocation } from "react-router-dom";
import TeamMemberSelect from "../Components/TeamMemberSelect"; // 班員を選ぶプルダウン（"従業員番号 - 氏名" で表示）
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/TeamPage/TeamList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 班員工数一覧の1行分のデータ（GET /api/team_list/ のレスポンス pagination_data.results の要素） */
interface Kosu {
  id: number; // 工数データのID（主キー）。詳細画面のURLに使う
  employee_no3: number; // 従業員番号
  name: string; // 氏名（サーバーからは人員データのIDが届くため、画面側で班員の氏名に置き換える）
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  tyoku2: string; // 直の番号（"1"〜"6"。formatTyoku で表示名に変換する）
  judgement: boolean; // 工数入力OK/NG判定（true: 入力内容に不整合なし）
}

/** 班員プルダウンの選択肢1件分（GET /api/team_list/ のレスポンス team_member_select の要素） */
interface TeamMember {
  id: number; // 人員データのID（主キー）
  employee_no: number; // 従業員番号（プルダウンの値・氏名の対応付けに使う）
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
 * 班員工数履歴画面。
 *
 * 表示時に1ページ目の班員工数データを取得し、表形式で表示する。
 * 検索欄で日付を選んでボタンを押すとその日（または月）のデータだけに、
 * 班員プルダウンで班員を選ぶとその班員のデータだけに絞り込む。
 *
 * @returns 班員工数履歴画面のJSX
 */
const TeamList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Kosu[]>([]); // 表に表示する工数データ（現在のページ分。氏名は置き換え済み）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  // 検索欄で選択中の日付。入力のたびに再描画しないよう state ではなく ref で保持する
  const searchDayRef = useRef<string>("");
  const [searchByMonth, setSearchByMonth] = useState<boolean>(false); // true: 月単位で検索 / false: 日単位で検索
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [teamMemberOptions, setTeamMemberOptions] = useState<TeamMember[]>([]); // 班員プルダウンの選択肢（登録済みの班員）
  const [selectedMember, setSelectedMember] = useState<string>(""); // 絞り込み中の班員の従業員番号（空文字なら全班員）
  const location = useLocation(); // 現在のURL情報（URLが変わったことの検知に使う）
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 班員の工数データ一覧をサーバーから取得し、state に保存する。
   *
   * 検索日・絞り込み班員が指定されている場合のみ、対応するパラメータを付けて送信する。
   * サーバーから届く name は人員データのIDのため、班員一覧を使って氏名に置き換えてから保存する。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメインメニューへ、
   * 400（班員未登録）なら班員メニューへメッセージ付きで遷移する。
   * useEffect の依存配列に入れるため useCallback で関数を使い回し、
   * selectedMember が変わったときだけ作り直す（作り直されると下の useEffect で再取得される）。
   *
   * @param page - 取得するページ番号（1始まり）
   * @param day  - 検索日（"YYYY-MM-DD"）。空文字なら日付の絞り込みなし
   * @param mode - true: 月単位で検索 / false: 日単位で検索
   * @returns なし（結果は data / teamMemberOptions / totalPages / error の state に反映）
   */
  const fetchData = useCallback(async (
    page: number,
    day: string,
    mode: boolean
  ) => {
    setLoading(true);
    try {
      // GET /api/team_list/ : ログイン者の班員全員の工数一覧と、班員プルダウン用の班員一覧を取得
      const response = await api.get("/api/team_list/", {
        params: {
          page: page,
          // 検索日がある場合だけ、日付絞り込み用のパラメータを追加する
          //   day   : 検索日
          //   mode  : "month"=同じ年月のデータすべて / "day"=その日のデータのみ
          //   filter: "true" のときだけサーバー側で日付の絞り込みが行われる
          ...(day && {
            day: day,
            mode: mode ? "month" : "day",
            filter: "true",
          }),
          // 班員が選ばれている場合だけ、その班員の従業員番号で絞り込む
          ...(selectedMember && {
            member_id: selectedMember,
          }),
        }
      });

      // pagination_data: { count: 総件数, page_size: 1ページの件数, results: 現在ページのデータ }
      const paginationData = response.data?.pagination_data || {};
      const results = paginationData.results || [];
      const pageSize = paginationData.page_size || 20;
      // team_member_select: 登録済み班員の人員データ一覧
      const memberOptions = response.data?.team_member_select || [];

      // 従業員番号 → 氏名 の対応表を作る（例: { 12345: "山田" }）
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: TeamMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 各行の name を班員の氏名に置き換える（対応表にない場合は "Unknown (従業員番号)" と表示）
      const transformedData = results.map((item: Kosu) => ({
        ...item,
        name: memberNameMap[item.employee_no3] || `Unknown (${item.employee_no3})`,
      }));

      setData(transformedData);
      setTeamMemberOptions(memberOptions);
      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(paginationData.count / pageSize));
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // 400: 班員が未登録 → 班員メニューへ戻し、サーバーのメッセージを表示してもらう
        else if (err.response?.status === 400)
          navigate("/team-menu", { state: { errorMessage: err.response?.data.message } });
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
  }, [navigate, selectedMember]);

  // ---------- 副作用（useEffect） ----------

  // 画面URL（pathname）が変わったとき: 検索条件・班員の絞り込みをリセットして1ページ目に戻す
  // （メニューから再度この画面に来たときに前回の検索条件が残らないようにする）
  useEffect(() => {
    searchDayRef.current = "";
    // 日付入力欄は ref 管理（非制御コンポーネント）のため、DOMを直接操作して表示を空にする
    const input = document.getElementById("search-day-input") as HTMLInputElement;
    if (input) input.value = "";
    setSearchByMonth(false);
    setCurrentPage(1);
    setSelectedMember("");
  }, [location.pathname]);

  // ページ番号・検索モード・fetchData（＝絞り込み班員）が変わったとき: その条件で一覧を取得し直す
  // （初回表示時も実行される）
  useEffect(() => {
    fetchData(currentPage, searchDayRef.current, searchByMonth);
  }, [currentPage, fetchData, searchByMonth]);

  // 絞り込み班員が変わったとき: 1ページ目に戻す
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMember]);

  // ---------- イベントハンドラ ----------

  /**
   * 「指定月」「指定日」ボタン押下時の検索処理。
   *
   * 検索モードを保存し、1ページ目から検索結果を取得し直す。
   *
   * @param isMonthSearch - true: 指定月で検索 / false: 指定日で検索
   * @returns なし
   */
  const handleSearch = (isMonthSearch: boolean) => {
    setSearchByMonth(isMonthSearch);
    setCurrentPage(1);
    // state の更新を待たずに、押されたボタンの条件ですぐに取得する
    fetchData(1, searchDayRef.current, isMonthSearch);
  };

  /**
   * 班員プルダウンの選択が変わったときの処理。
   *
   * 選ばれた班員の従業員番号を保存して1ページ目に戻す。
   * selectedMember が変わると fetchData が作り直され、useEffect により一覧が再取得される。
   *
   * @param event - プルダウンの変更イベント（value: 選ばれた班員の従業員番号。未選択は空文字）
   * @returns なし
   */
  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMember(event.target.value);
    setCurrentPage(1);
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      {/* ローディング表示（この位置では loading は常に false のため、フェードアウトして消える） */}
      <Loading isLoading={loading} />
      <div className={styles["team-list-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          班員工数履歴
        </h1>

        {/* 班員メニュー画面へ戻るリンク */}
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>

        {/* 日付検索欄: 日付を選択し、「指定月」または「指定日」で絞り込む（高さを表の高さ計算に使うため ref を付ける） */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label htmlFor="search-day-input"></label>
          {/* 日付入力欄: 値は state ではなく searchDayRef に保存する（入力のたびに再描画しない） */}
          <input
            id="search-day-input"
            type="date"
            defaultValue={searchDayRef.current}
            onChange={(e) => { searchDayRef.current = e.target.value; }}
            placeholder="日付を選択"
          />
          {/* 検索ボタン群 */}
          <div className={styles["button-group"]}>
            {/* 選択した日付と同じ年月のデータをすべて表示 */}
            <button
              onClick={() => handleSearch(true)}
              className="orange_button"
            >
              指定月
            </button>
            {/* 選択した日付のデータのみ表示 */}
            <button
              onClick={() => handleSearch(false)}
              className="orange_button"
            >
              指定日
            </button>
          </div>
        </div>

        {/* 班員絞り込み欄: 班員を選ぶとその班員の工数データだけを表示（未選択なら全班員） */}
        <div className={styles["search-bar"]}>
          <label htmlFor="team-member-select"></label>
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMember}
            onChange={handleMemberChange}
            options={teamMemberOptions}
          />
        </div>

        {/* データが0件ならメッセージ、1件以上なら一覧表を表示 */}
        {data.length === 0 ? (
          <p>No data found.</p>
        ) : (
          <TableContainer
            searchBarRef={searchBarRef}
            headerRef={headerRef}
          >
            <table>
              {/* 表の見出し行 */}
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>班員</th>
                  <th className={styles["th-collar"]}>就業日</th>
                  <th className={styles["th-collar"]}>直</th>
                  <th className={styles["th-collar"]}>整合性</th>
                  <th className={styles["th-collar"]}>詳細</th>
                </tr>
              </thead>
              {/* 表の本体: 工数データ1件につき1行を表示（key には工数データのIDを使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    {/* 班員の氏名 */}
                    <td>{item.name}</td>
                    {/* 就業日と曜日（例: 2026-11-09 (月)） */}
                    <td>{item.work_day2} ({getDayOfWeek(item.work_day2)})</td>
                    {/* 直の名称 */}
                    <td>{formatTyoku(item.tyoku2)}</td>
                    {/* 整合性: 工数入力OK/NG判定に応じて文字と色を切り替える */}
                    <td className={item.judgement ? styles["status-ok"] : styles["status-ng"]}>
                      {item.judgement ? "OK" : "NG"}
                    </td>
                    {/* 班員工数詳細画面へのリンク（URLに工数データのIDを含める） */}
                    <td>
                      <Link
                        to={`/team-detail/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        詳細
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
              buttonColor="#f50"
              hoverColor="#f10"
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
export default TeamList;