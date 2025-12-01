import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import './styles/global.css';
import Login from './MainPage/Login';
import MainMenu from './MainPage/MainMenu';
import KosuMenu from './KosuPage/KosuMenu';
import KosuNew from './KosuPage/KosuNew';
import KosuList from './KosuPage/KosuList';
import KosuEdit from './KosuPage/KosuEdit';
import KosuDelete from './KosuPage/KosuDelete';
import TodayBreakTime from './KosuPage/TodayBreakTime';
import BreakTime from './KosuPage/BreakTime';
import KosuCalendar from './KosuPage/KosuCalendar';
import KosuTotal from './KosuPage/KosuTotal';
import DefMenu from './DefinitionPage/DefMenu';
import DefSearch from './DefinitionPage/DefSearch';
import DefNew from './DefinitionPage/DefNew';
import DefList from './DefinitionPage/DefList';
import DefEdit from './DefinitionPage/DefEdit';
import DefDelete from './DefinitionPage/DefDelete';
import DefVer from './DefinitionPage/DefVer';
import MemberMenu from './MemberPage/MemberMenu';
import MemberNew from './MemberPage/MemberNew';
import MemberList from './MemberPage/MemberList';
import MemberEdit from './MemberPage/MemberEdit';
import MemberDelete from './MemberPage/MemberDelete';
import TeamMenu from './TeamPage/TeamMenu';
import TeamNew from './TeamPage/TeamNew';
import TeamList from './TeamPage/TeamList';
import TeamDetail from './TeamPage/TeamDetail';
import TeamCalendar from './TeamPage/TeamCalendar';
import TeamOverTime from './TeamPage/TeamOverTime';
import TeamView from './TeamPage/TeamView';
import InquirMenu from './InquirPage/InquirMenu';
import InquirNew from './InquirPage/InquirNew';
import InquirList from './InquirPage/InquirList';
import InquirDetail from './InquirPage/InquirDetail';
import InquirUpdate from './InquirPage/InquirUpdate';
import AdministratorMenu from './AdministratorPage/AdministratorMenu';
import AdministratorUpdate from './AdministratorPage/AdministratorUpdate';



const App: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const routeTitles: { [key: string]: string } = {
      "/login": "ログイン - 業務工数システム",
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
      "/admin-menu": "管理者Menu - 業務工数システム",
      "/admin-update": "設定編集 - 業務工数システム",
    };

    // URLに基づいてタイトルを設定
    document.title = routeTitles[location.pathname] || "業務工数システム";
  }, [location]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<MainMenu />} />
      <Route path="/kosu-menu" element={<KosuMenu />} />
      <Route path="/kosu-new" element={<KosuNew />} />
      <Route path="/kosu-list" element={<KosuList />} />
      <Route path="/kosu-update/:id" element={<KosuEdit />} />
      <Route path="/kosu-delete/:id" element={<KosuDelete />} />
      <Route path="/today-break-time" element={<TodayBreakTime />} />
      <Route path="/break-time" element={<BreakTime />} />
      <Route path="/kosu-calendar" element={<KosuCalendar />} />
      <Route path="/kosu-total" element={<KosuTotal />} />
      <Route path="/def-menu" element={<DefMenu />} />
      <Route path="/def-search" element={<DefSearch />} />
      <Route path="/def-new" element={<DefNew />} />
      <Route path="/def-list" element={<DefList />} />
      <Route path="/def-update/:id" element={<DefEdit />} />
      <Route path="/def-delete/:id" element={<DefDelete />} />
      <Route path="/def-ver" element={<DefVer />} />
      <Route path="/member-menu" element={<MemberMenu />} />
      <Route path="/member-new" element={<MemberNew />} />
      <Route path="/member-list" element={<MemberList />} />
      <Route path="/member-update/:employee_no" element={<MemberEdit />} />
      <Route path="/member-delete/:employee_no" element={<MemberDelete />} />
      <Route path="/team-menu" element={<TeamMenu />} />
      <Route path="/team-new" element={<TeamNew />} />
      <Route path="/team-list" element={<TeamList />} />
      <Route path="/team-detail/:id" element={<TeamDetail />} />
      <Route path="/team-calendar" element={<TeamCalendar />} />
      <Route path="/team-overtime" element={<TeamOverTime />} />
      <Route path="/team-view" element={<TeamView />} />
      <Route path="/inquir-menu" element={<InquirMenu />} />
      <Route path="/inquir-new" element={<InquirNew />} />
      <Route path="/inquir-list" element={<InquirList />} />
      <Route path="/inquir-detail/:id" element={<InquirDetail />} />
      <Route path="/inquir-update/:id" element={<InquirUpdate />} />
      <Route path="/manager-menu" element={<AdministratorMenu />} />
      <Route path="/manager-update" element={<AdministratorUpdate />} />
    </Routes>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);