/**
 * ============================================================
 * ファイル名 : index.tsx
 * 種別       : エントリーポイント（アプリの起動地点）・ルーティング定義
 * 概要       : React アプリが最初に実行するファイル。
 *              画面URLと表示する画面コンポーネントの対応（ルーティング）を定義し、
 *              HTML の <div id="root"> の中にアプリ全体を描画する。
 *              画面URLが変わるたびに、ブラウザのタブに表示されるタイトルも切り替える。
 *
 * 主な機能   :
 *   - 画面URL → 画面コンポーネント の対応表（React Router の Routes / Route）
 *   - 画面ごとのページタイトル（document.title）の設定
 *   - アプリ全体を BrowserRouter（URLに応じて画面を切り替える仕組み）で包んで描画
 *
 * 補足       : 画面URL（例: /kosu-list）に直接アクセスしたときも、Django 側（hozen_another/urls.py）が
 *              API 以外のURLにはすべて同じ index.html を返すため、この対応表で画面が選ばれる。
 * 関連ファイル: frontend/index.html（開発時に Vite が読み込むHTML。ここから index.tsx を読み込む）,
 *              styles/global.css（全画面共通のスタイル）, 各画面フォルダ（MainPage/ KosuPage/ など）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React from 'react';
import ReactDOM from 'react-dom/client'; // React の画面をHTMLに描画するためのライブラリ
// React Router: URLに応じて表示する画面を切り替えるライブラリ
//   BrowserRouter（Router という別名で使用）: ブラウザのURLと画面表示を連動させる外枠
//   Routes / Route: 「このURLならこの画面」という対応表 / useLocation: 現在のURL情報を取得するフック
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import './styles/global.css'; // 全画面に適用される共通スタイル
// メイン（ログイン・ヘルプ・メインメニュー）の画面
import Login from './MainPage/Login';
import Help from './MainPage/Help';
import MainMenu from './MainPage/MainMenu';
// 工数（入力・一覧・編集・休憩時間・勤務入力・集計）の画面
import KosuMenu from './KosuPage/KosuMenu';
import KosuNew from './KosuPage/KosuNew';
import KosuList from './KosuPage/KosuList';
import KosuEdit from './KosuPage/KosuEdit';
import KosuDelete from './KosuPage/KosuDelete';
import TodayBreakTime from './KosuPage/TodayBreakTime';
import BreakTime from './KosuPage/BreakTime';
import KosuCalendar from './KosuPage/KosuCalendar';
import KosuTotal from './KosuPage/KosuTotal';
// 工数区分定義・作業詳細選択肢の画面
import DefMenu from './DefinitionPage/DefMenu';
import DefSearch from './DefinitionPage/DefSearch';
import DefNew from './DefinitionPage/DefNew';
import DefList from './DefinitionPage/DefList';
import DefEdit from './DefinitionPage/DefEdit';
import DefDelete from './DefinitionPage/DefDelete';
import DefVer from './DefinitionPage/DefVer';
import DefDetailNew from './DefinitionPage/DefDetailNew';
import DefDetailList from './DefinitionPage/DefDetailList';
import DefDetailEdit from './DefinitionPage/DefDetailEdit';
import DefDetailDelete from './DefinitionPage/DefDetailDelete';
// 人員の画面
import MemberMenu from './MemberPage/MemberMenu';
import MemberNew from './MemberPage/MemberNew';
import MemberList from './MemberPage/MemberList';
import MemberEdit from './MemberPage/MemberEdit';
import MemberDelete from './MemberPage/MemberDelete';
// 班員の画面
import TeamMenu from './TeamPage/TeamMenu';
import TeamNew from './TeamPage/TeamNew';
import TeamList from './TeamPage/TeamList';
import TeamDetail from './TeamPage/TeamDetail';
import TeamCalendar from './TeamPage/TeamCalendar';
import TeamOverTime from './TeamPage/TeamOverTime';
import TeamView from './TeamPage/TeamView';
// 問い合わせの画面
import InquirMenu from './InquirPage/InquirMenu';
import InquirNew from './InquirPage/InquirNew';
import InquirList from './InquirPage/InquirList';
import InquirDetail from './InquirPage/InquirDetail';
import InquirUpdate from './InquirPage/InquirUpdate';
// 管理者の画面
import AdministratorMenu from './AdministratorPage/AdministratorMenu';
import AdministratorUpdate from './AdministratorPage/AdministratorUpdate';
import AdministratorLoading from './AdministratorPage/AdministratorLoading';
import AdministratorKosuList from './AdministratorPage/AdministratorKosuList';
import AdministratorKosuUpdate from './AdministratorPage/AdministratorKosuUpdate';
import AdministratorTaskList from './AdministratorPage/AdministratorTaskList';
import AdministratorTaskDetail from './AdministratorPage/AdministratorTaskDetail';
import AdministratorHistoryList from './AdministratorPage/AdministratorHistoryList';
import AdministratorHistoryDetail from './AdministratorPage/AdministratorHistoryDetail';



// ============================================================
// コンポーネント本体
// ============================================================

/**
 * アプリ全体のルート（根元）コンポーネント。
 *
 * 現在の画面URLに対応する画面コンポーネントを1つ表示し、ブラウザのタブのタイトルも切り替える。
 * useLocation を使うため、BrowserRouter（下の root.render 内の Router）の内側で使う必要がある。
 *
 * @returns URLに対応する画面のJSX
 */
const App: React.FC = () => {
  const location = useLocation(); // 現在の画面URL情報（pathname に "/kosu-list" などが入る）

  // ---------- 副作用（useEffect） ----------

  // 画面URL（location）が変わったとき: ブラウザのタブに表示するタイトルを、その画面用に切り替える
  React.useEffect(() => {
    // 画面URL → タブのタイトル の対応表
    //   ※location.pathname には "/kosu-update/12" のように実際の値が入るため、
    //     ":id" や ":employee_no" を含むキーとは一致せず、それらの画面では下の既定タイトルになる
    const routeTitles: { [key: string]: string } = {
      "/login": "ログイン - 業務工数システム",
      "/help": "ヘルプ - 業務工数システム",
      "/": "Main Menu - 業務工数システム",
      "/kosu-menu": "工数Menu - 業務工数システム",
      "/kosu-new": "工数入力 - 業務工数システム",
      "/kosu-list": "工数一覧 - 業務工数システム",
      "/kosu-update/:id": "工数編集 - 業務工数システム",
      "/kosu-delete/:id": "工数削除 - 業務工数システム",
      "/today-break-time": "当日休憩時間変更 - 業務工数システム",
      "/break-time": "休憩時間変更 - 業務工数システム",
      "/kosu-calendar": "勤務入力 - 業務工数システム",
      "/kosu-total": "工数集計 - 業務工数システム",
      "/def-menu": "工数区分定義Menu - 業務工数システム",
      "/def-search": "工数区分定義切り替え - 業務工数システム",
      "/def-new": "工数区分定義登録 - 業務工数システム",
      "/def-list": "工数区分定義一覧 - 業務工数システム",
      "/def-update/:id": "工数区分定義編集 - 業務工数システム",
      "/def-delete/:id": "工数区分定義削除 - 業務工数システム",
      "/def-ver": "工数区分定義切り替え - 業務工数システム",
      "/def-detail-new": "作業詳細選択肢登録 - 業務工数システム",
      "/def-detail-list": "作業詳細選択肢一覧 - 業務工数システム",
      "/def-detail-update/:id": "作業詳細選択肢編集 - 業務工数システム",
      "/def-detail-delete/:id": "作業詳細選択肢削除 - 業務工数システム",
      "/member-menu": "人員Menu - 業務工数システム",
      "/member-new": "人員登録 - 業務工数システム",
      "/member-list": "人員一覧 - 業務工数システム",
      "/member-update/:employee_no": "人員編集 - 業務工数システム",
      "/member-delete/:employee_no": "人員削除 - 業務工数システム",
      "/team-menu": "班員Menu - 業務工数システム",
      "/team-new": "班員登録 - 業務工数システム",
      "/team-list": "班員工数履歴 - 業務工数システム",
      "/team-detail/:id": "班員工数履歴詳細 - 業務工数システム",
      "/team-calendar": "班員工数入力状況 - 業務工数システム",
      "/team-overtime": "班員残業 - 業務工数システム",
      "/team-view": "ショップ単位工数入力状況 - 業務工数システム",
      "/inquir-menu": "問い合わせMenu - 業務工数システム",
      "/inquir-new": "問い合わせ - 業務工数システム",
      "/inquir-list": "問い合わせ履歴 - 業務工数システム",
      "/inquir-detail/:id": "問い合わせ内容 - 業務工数システム",
      "/inquir-update/:id": "問い合わせ編集 - 業務工数システム",
      "/manager-menu": "管理者Menu - 業務工数システム",
      "/manager-update": "設定編集 - 業務工数システム",
      "/manager-loading": "データ管理 - 業務工数システム",
      "/manager-kosu": "全工数管理 - 業務工数システム",
      "/manager-kosu-update/:id": "全工数編集 - 業務工数システム",
      "/manager-task": "非同期タスクデータ管理 - 業務工数システム",
      "/manager-task-detail/:id": "非同期タスク詳細 - 業務工数システム",
      "/manager-history": "データ操作履歴一覧 - 業務工数システム",
      "/manager-history-detail/:id": "データ操作履歴詳細 - 業務工数システム",
    };

    // URLに基づいてタイトルを設定
    //   対応表に無いURLの場合は「業務工数システム」だけを表示する
    document.title = routeTitles[location.pathname] || "業務工数システム";
  }, [location]);

  // ---------- 描画（JSX） ----------

  // URLの対応表。現在のURLと一致する path の Route の element（画面）だけが表示される
  //   path の ":id" などはURLの一部を変数として受け取る書き方（例: /kosu-update/12 → id = "12"）。
  //   受け取った値は各画面で useParams() を使って読み取る
  return (
    <Routes>
      {/* ===== メイン ===== */}
      {/* ログイン画面 */}
      <Route path="/login" element={<Login />} />
      {/* ヘルプ画面（パスワード認証後にデータ初期化ができる） */}
      <Route path="/help" element={<Help />} />
      {/* メインメニュー画面（トップページ） */}
      <Route path="/" element={<MainMenu />} />

      {/* ===== 工数 ===== */}
      {/* 工数メニュー画面 */}
      <Route path="/kosu-menu" element={<KosuMenu />} />
      {/* 工数入力画面 */}
      <Route path="/kosu-new" element={<KosuNew />} />
      {/* 工数履歴一覧画面（ログイン者本人の工数データ一覧） */}
      <Route path="/kosu-list" element={<KosuList />} />
      {/* 工数データ編集画面（:id = 工数データのID） */}
      <Route path="/kosu-update/:id" element={<KosuEdit />} />
      {/* 工数データ削除画面（:id = 工数データのID） */}
      <Route path="/kosu-delete/:id" element={<KosuDelete />} />
      {/* 当日休憩時間変更画面（その日だけの休憩時間を変更） */}
      <Route path="/today-break-time" element={<TodayBreakTime />} />
      {/* 休憩時間変更画面（直ごとの休憩時間の既定値を変更） */}
      <Route path="/break-time" element={<BreakTime />} />
      {/* 勤務入力画面（月カレンダーで就業形態・直を入力） */}
      <Route path="/kosu-calendar" element={<KosuCalendar />} />
      {/* 工数集計画面 */}
      <Route path="/kosu-total" element={<KosuTotal />} />

      {/* ===== 工数区分定義・作業詳細選択肢 ===== */}
      {/* 工数区分定義メニュー画面 */}
      <Route path="/def-menu" element={<DefMenu />} />
      {/* 工数区分定義確認画面（選択中の工数区分定義Verの内容を表示） */}
      <Route path="/def-search" element={<DefSearch />} />
      {/* 工数区分定義登録画面 */}
      <Route path="/def-new" element={<DefNew />} />
      {/* 工数区分定義一覧画面 */}
      <Route path="/def-list" element={<DefList />} />
      {/* 工数区分定義編集画面（:id = 工数区分定義のID） */}
      <Route path="/def-update/:id" element={<DefEdit />} />
      {/* 工数区分定義削除画面（:id = 工数区分定義のID） */}
      <Route path="/def-delete/:id" element={<DefDelete />} />
      {/* 工数区分定義切り替え画面（使用する工数区分定義Verを選ぶ） */}
      <Route path="/def-ver" element={<DefVer />} />
      {/* 作業詳細選択肢登録画面 */}
      <Route path="/def-detail-new" element={<DefDetailNew />} />
      {/* 作業詳細選択肢一覧画面 */}
      <Route path="/def-detail-list" element={<DefDetailList />} />
      {/* 作業詳細選択肢編集画面（:id = 作業詳細選択肢のID） */}
      <Route path="/def-detail-update/:id" element={<DefDetailEdit />} />
      {/* 作業詳細選択肢削除画面（:id = 作業詳細選択肢のID） */}
      <Route path="/def-detail-delete/:id" element={<DefDetailDelete />} />

      {/* ===== 人員 ===== */}
      {/* 人員メニュー画面 */}
      <Route path="/member-menu" element={<MemberMenu />} />
      {/* 人員登録画面 */}
      <Route path="/member-new" element={<MemberNew />} />
      {/* 人員データ一覧画面 */}
      <Route path="/member-list" element={<MemberList />} />
      {/* 人員データ編集画面（:employee_no = 従業員番号） */}
      <Route path="/member-update/:employee_no" element={<MemberEdit />} />
      {/* 人員削除画面（:employee_no = 従業員番号） */}
      <Route path="/member-delete/:employee_no" element={<MemberDelete />} />

      {/* ===== 班員 ===== */}
      {/* 班員メニュー画面 */}
      <Route path="/team-menu" element={<TeamMenu />} />
      {/* 班員登録画面 */}
      <Route path="/team-new" element={<TeamNew />} />
      {/* 班員工数履歴画面（班員の工数データ一覧） */}
      <Route path="/team-list" element={<TeamList />} />
      {/* 班員の工数履歴詳細画面（:id = 工数データのID） */}
      <Route path="/team-detail/:id" element={<TeamDetail />} />
      {/* 班員工数入力状況画面（週単位） */}
      <Route path="/team-calendar" element={<TeamCalendar />} />
      {/* 班員残業画面（班員の残業時間を月単位で表示） */}
      <Route path="/team-overtime" element={<TeamOverTime />} />
      {/* ショップ単位の工数入力状況画面（画面見出しは「工数入力状況(全体)」） */}
      <Route path="/team-view" element={<TeamView />} />

      {/* ===== 問い合わせ ===== */}
      {/* 問い合わせメニュー画面 */}
      <Route path="/inquir-menu" element={<InquirMenu />} />
      {/* 問い合わせ登録画面 */}
      <Route path="/inquir-new" element={<InquirNew />} />
      {/* 問い合わせ履歴画面 */}
      <Route path="/inquir-list" element={<InquirList />} />
      {/* 問い合わせ詳細画面（:id = 問い合わせのID） */}
      <Route path="/inquir-detail/:id" element={<InquirDetail />} />
      {/* 問い合わせ編集画面（:id = 問い合わせのID） */}
      <Route path="/inquir-update/:id" element={<InquirUpdate />} />

      {/* ===== 管理者 ===== */}
      {/* 管理者メニュー画面 */}
      <Route path="/manager-menu" element={<AdministratorMenu />} />
      {/* 設定編集画面（管理者設定の編集） */}
      <Route path="/manager-update" element={<AdministratorUpdate />} />
      {/* データ管理画面（バックアップ・復元・期間指定削除） */}
      <Route path="/manager-loading" element={<AdministratorLoading />} />
      {/* 全工数管理画面（全人員の工数データ一覧） */}
      <Route path="/manager-kosu" element={<AdministratorKosuList />} />
      {/* 全工数データ編集画面（:id = 工数データのID） */}
      <Route path="/manager-kosu-update/:id" element={<AdministratorKosuUpdate />} />
      {/* 非同期タスクデータ管理画面（非同期タスクの一覧） */}
      <Route path="/manager-task" element={<AdministratorTaskList />} />
      {/* 非同期タスク詳細画面（:id = 非同期タスクのID） */}
      <Route path="/manager-task-detail/:id" element={<AdministratorTaskDetail />} />
      {/* データ操作履歴一覧画面 */}
      <Route path="/manager-history" element={<AdministratorHistoryList />} />
      {/* データ操作履歴詳細画面（:id = 操作履歴のID） */}
      <Route path="/manager-history-detail/:id" element={<AdministratorHistoryDetail />} />
    </Routes>
  );
};

// ============================================================
// アプリの起動（HTMLへの描画）
// ============================================================

// HTML の <div id="root"></div> を、React が画面を描画する場所として登録する
//   as HTMLElement: getElementById は「見つからない場合 null」の型を返すため、必ず存在するものとして扱う指定
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// アプリ全体を描画する
//   React.StrictMode: 開発時だけ、問題になりやすい書き方を検出するための追加チェックを行う（本番の動作には影響しない）
//   Router（BrowserRouter）: App の中で useLocation や Routes を使えるよう、外側から包む
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);