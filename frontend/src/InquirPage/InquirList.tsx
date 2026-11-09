/**
 * ============================================================
 * ファイル名 : InquirList.tsx
 * 種別       : 画面コンポーネント（問い合わせ履歴画面）
 * 概要       : 全員分の問い合わせデータを新しい順（IDの大きい順）に一覧表示する画面。
 *              問い合わせ者・内容（要望 / 不具合 / 問い合わせ）で絞り込みができる。
 *
 * 主な機能   :
 *   - 問い合わせデータ一覧の取得と表示（ページネーション付き）
 *   - 問い合わせ者 / 内容 での絞り込み検索
 *   - 問い合わせ本文・回答は先頭3文字だけ表示し、各行の問い合わせ者名リンクから問い合わせ詳細画面へ遷移
 *
 * 使用API    : GET /api/inquir_list/  問い合わせ一覧と問い合わせ者一覧の取得（kosu/views/inquiry_views.py の InquirList）
 * 画面URL    : /inquir-list          （index.tsx のルーティング定義）
 * 関連ファイル: styles/InquirPage/InquirList.module.css,
 *              Components/ItemSelect.tsx, Components/TeamMemberSelect.tsx,
 *              Components/TableContainer.tsx, Components/Pagination.tsx, Components/Loading.tsx
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  useRef
} from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate, useLocation } from "react-router-dom";
import ItemSelect from "../Components/ItemSelect"; // 内容（要望/不具合/問い合わせ）のプルダウン
import TeamMemberSelect from "../Components/TeamMemberSelect"; // 人員（問い合わせ者）のプルダウン
import TableContainer from "../Components/TableContainer"; // 画面の高さに合わせてスクロールする表の外枠
import Pagination from "../Components/Pagination"; // ページ切り替えボタン
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/InquirPage/InquirList.module.css";

// ============================================================
// 型定義
// ============================================================

/** 問い合わせ一覧の1行分のデータ（レスポンス inquir_data.results の要素。画面で使う項目のみ定義） */
interface Inquir {
  id: number; // 問い合わせデータのID（主キー）。No.列の表示と詳細画面のURLに使う
  employee_no2: number; // 問い合わせ者の従業員番号
  name: string; // 問い合わせ者の氏名（サーバーからは人員データのIDが届くが、取得後に氏名へ置き換える）
  content_choice: string; // 内容（"要望" / "不具合" / "問い合わせ"）
  inquiry: string; // 問い合わせ本文
  answer: string; // 回答（未回答なら空文字）
}

/** 問い合わせ者1人分の人員データ（レスポンス member_data の要素。画面で使う項目のみ定義） */
interface InquirMember {
  id: number; // 人員データのID（主キー）
  employee_no: number; // 従業員番号（絞り込みプルダウンの値になる）
  name: string; // 氏名
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 問い合わせ履歴画面。
 *
 * 表示時に1ページ目の問い合わせ一覧を取得し、表形式で表示する。
 * 検索欄で問い合わせ者・内容を選んで「検索」を押すと、その条件で絞り込む。
 * 検索欄の選択中の値（〜Input）と、実際に検索に使う値を別々の state で持ち、
 * 「検索」ボタンを押したときだけ検索条件として確定させる。
 *
 * @returns 問い合わせ履歴画面のJSX
 */
const InquirList: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [data, setData] = useState<Inquir[]>([]); // 表に表示する問い合わせデータ（現在のページ分）
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中かどうか（true の間はローディング表示）
  const [error, setError] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [currentPage, setCurrentPage] = useState<number>(1); // 現在表示しているページ番号（1始まり）
  const [totalPages, setTotalPages] = useState<number>(0); // 総ページ数
  const [MemberOptions, setMemberOptions] = useState<InquirMember[]>([]); // 問い合わせ者プルダウンの選択肢（問い合わせをしたことがある人員）
  const [searchItemInput, setSearchItemInput] = useState<string>(""); // 内容プルダウンで選択中の値（まだ検索には使われない）
  const [searchItem, setSearchItem] = useState<string>(""); // 検索に使う内容（「検索」押下で確定した値。"" なら絞り込みなし）
  const [selectedMemberInput, setSelectedMemberInput] = useState<string>(""); // 問い合わせ者プルダウンで選択中の従業員番号（まだ検索には使われない）
  const [searchMemberId, setSearchMemberId] = useState<string>(""); // 検索に使う従業員番号（「検索」押下で確定した値。"" なら絞り込みなし）
  const location = useLocation(); // 現在のURL情報（URLが変わったことの検知に使う）
  const navigate = useNavigate(); // 画面遷移用の関数

  // 表の高さ計算用に、検索欄と見出しのDOM要素を参照する（TableContainer に渡す）
  const searchBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  // ---------- データ取得 ----------

  /**
   * 問い合わせ一覧と問い合わせ者一覧をサーバーから取得し、state に保存する。
   *
   * 現在のページ番号と、確定済みの検索条件（問い合わせ者・内容）を送信する。
   * 一覧の氏名は、一緒に受け取った問い合わせ者一覧から従業員番号で引き当てて表示用に置き換える。
   * 401（未ログイン・工数区分定義Ver未選択）ならログイン画面へ、403（権限なし）ならメインメニューへ遷移する。
   * 依存する値（ページ番号・検索条件）が変わると関数が作り直され、下の useEffect で再取得される。
   *
   * @returns なし（結果は data / MemberOptions / totalPages / error の state に反映）
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/inquir_list/ : 問い合わせ一覧（ページ分）と問い合わせ者一覧を取得
      const response = await api.get(
        "/api/inquir_list/",
        {
          params: {
            page: currentPage,
            // 問い合わせ者が指定されているときだけ追加（member_id: 従業員番号。サーバー側では部分一致で絞り込まれる）
            ...(searchMemberId && {
              member_id: searchMemberId,
            }),
            // 内容が指定されているときだけ追加（item: "要望" / "不具合" / "問い合わせ"）
            ...(searchItem && {
              item: searchItem,
            }),
          }
        }
      );

      // inquir_data: ページネーション情報付きの一覧
      //   results: 現在ページのデータ / page_size: 1ページの件数（管理者設定の一覧表示項目数） / count: 総件数
      // member_data: 問い合わせをしたことがある人員の一覧（問い合わせ者プルダウンの選択肢）
      const paginationData = response.data?.inquir_data || {};
      const results = paginationData.results || [];
      const pageSize = paginationData.page_size || 20;
      const memberOptions = response.data?.member_data || [];

      // 従業員番号 → 氏名 の対応表を作る（例: { 12345: "山田太郎" }）
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: InquirMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      // 一覧の各行の name を氏名に置き換える
      // 対応表に無い（人員データから削除された等）場合は「Unknown (従業員番号)」と表示する
      const transformedData = results.map((item: Inquir) => ({
        ...item,
        name:
          memberNameMap[item.employee_no2] ||
          `Unknown (${item.employee_no2})`,
      }));

      setData(transformedData);
      setMemberOptions(memberOptions);
      // 総件数 ÷ 1ページの件数 を切り上げて総ページ数を求める
      setTotalPages(Math.ceil(paginationData.count / pageSize));
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
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
  }, [currentPage, navigate, searchMemberId, searchItem]);

  // ---------- 副作用（useEffect） ----------

  // 画面URL（pathname）が変わったとき: ページ番号と検索条件（選択中・確定済みの両方）をリセットする
  // （メニューから再度この画面に来たときに前回の検索条件が残らないようにする）
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMemberInput("");
    setSearchMemberId("");
    setSearchItemInput("");
    setSearchItem("");
  }, [location.pathname]);

  // fetchData が作り直されたとき（＝ページ番号か確定済みの検索条件が変わったとき）: 一覧を取得し直す
  // （初回表示時も実行される）
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- イベントハンドラ ----------

  /**
   * 「検索」ボタン押下時の処理。
   *
   * 2ページ目以降を表示中なら、1ページ目に戻すだけで検索条件の確定は行わない。
   * 1ページ目を表示中で、選択中の値が確定済みの検索条件と違うときだけ、検索条件を確定させる
   * （state が変わると fetchData が作り直され、useEffect で再取得される）。
   *
   * @returns なし
   */
  const handleSearch = () => {
    // 選択中の値が、確定済みの検索条件から変わっているか
    const isMemberChanged = selectedMemberInput !== searchMemberId;
    const isItemChanged = searchItemInput !== searchItem;

    if (currentPage !== 1) {
      // 2ページ目以降: 1ページ目に戻す（この時点では検索条件は確定されない）
      setCurrentPage(1);
    } else if (isMemberChanged || isItemChanged) {
      // 1ページ目で条件が変わった: 選択中の値を検索条件として確定する
      setSearchMemberId(selectedMemberInput);
      setSearchItem(searchItemInput);
    }
  };

  /**
   * 問い合わせ者プルダウンの選択を「選択中の値」に保存する（検索はまだ行わない）。
   *
   * @param event - プルダウンの変更イベント（value は従業員番号）
   * @returns なし
   */
  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMemberInput(event.target.value);
  };

  // ---------- 描画（JSX） ----------

  // エラー発生時はエラーメッセージだけを出す
  if (error) return <div>Error: {error}</div>;
  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;
  // データが無い場合（data は常に配列のため、実際にはここに来ない）
  if (!data) return <div>データが見つかりません</div>;

  return (
    <>
      <div className={styles["inquir-list-wrapper"]}>
        {/* 画面タイトル（高さを表の高さ計算に使うため ref を付ける） */}
        <h1
          ref={headerRef}
          className={styles["h1-collar"]}
        >
          問い合わせ履歴
        </h1>

        {/* 問い合わせMENU画面へ戻るリンク */}
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-menu">問い合わせMENU</Link>
        </nav>

        {/* 検索欄: 問い合わせ者・内容を選び、「検索」で絞り込む（高さを表の高さ計算に使うため ref を付ける） */}
        <div
          ref={searchBarRef}
          className={styles["search-bar"]}
        >
          <label htmlFor="team-member-select"></label>
          {/* 問い合わせ者の選択（選択肢は問い合わせをしたことがある人員） */}
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMemberInput}
            onChange={handleMemberChange}
            options={MemberOptions}
          />
          <label htmlFor="ItemSelect"></label>
          {/* 内容（要望/不具合/問い合わせ）の選択 */}
          <ItemSelect
            id="ItemSelect"
            name="ItemSelect"
            value={searchItemInput}
            onChange={(e) => setSearchItemInput(e.target.value)}
          />
          {/* 検索ボタン */}
          <button onClick={handleSearch} className="pink_button">
            検索
          </button>
        </div>

        {/* データが0件ならメッセージ、1件以上なら一覧表を表示 */}
        {data.length === 0 && !loading ? (
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
                  <th className={styles["th-collar"]}>No.</th>
                  <th className={styles["th-collar"]}>問い合わせ者</th>
                  <th className={styles["th-collar"]}>内容</th>
                  <th className={styles["th-collar"]}>問い合わせ</th>
                  <th className={styles["th-collar"]}>回答</th>
                </tr>
              </thead>
              {/* 表の本体: 問い合わせデータ1件につき1行を表示（key には問い合わせデータのIDを使う） */}
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    {/* No.（問い合わせデータのID） */}
                    <td>{item.id}</td>
                    {/* 問い合わせ者の氏名（問い合わせ詳細画面へのリンク。URLに問い合わせデータのIDを含める） */}
                    <td>
                      <Link
                        to={`/inquir-detail/${item.id}`}
                        className={styles["a-collar"]}
                      >
                        {item.name}
                      </Link>
                    </td>
                    {/* 内容 */}
                    <td>{item.content_choice}</td>
                    {/* 問い合わせ本文: 4文字以上なら先頭3文字 + "..." に省略して表示 */}
                    <td>
                      {(item.inquiry || "").length > 3
                        ? item.inquiry.substring(0, 3) + "..."
                        : item.inquiry}
                    </td>
                    {/* 回答: 4文字以上なら先頭3文字 + "..." に省略して表示（未回答なら空欄） */}
                    <td>
                      {(item.answer || "").length > 3
                        ? item.answer.substring(0, 3) + "..."
                        : item.answer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ページ切り替えボタン（押すと currentPage が変わり、fetchData が作り直されて再取得される） */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              buttonColor="#ff69b4"
              hoverColor="#ff1493"
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
export default InquirList;