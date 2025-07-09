import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import './styles/global.css';
import Login from './MainPage/Login';
import MainMenu from './MainPage/MainMenu';
import DefMenu from './DefinitionPage/DefMenu';
import DefSearch from './DefinitionPage/DefSearch';
import DefNew from './DefinitionPage/DefNew';
import DefList from './DefinitionPage/DefList';
import DefEdit from './DefinitionPage/DefEdit';
import DefVer from './DefinitionPage/DefVer';
import MemberMenu from './MemberPage/MemberMenu';
import MemberNew from './MemberPage/MemberNew';
import MemberList from './MemberPage/MemberList';
import MemberEdit from './MemberPage/MemberEdit';
import MemberDelete from './MemberPage/MemberDelete';



const App: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const routeTitles: { [key: string]: string } = {
      "/login": "ログイン - 業務工数システム",
      "/": "Main Menu - 業務工数システム",
      "/def-menu": "工数区分定義Menu - 業務工数システム",
      "/def-search": "工数区分定義切り替え - 業務工数システム",
      "/def-new": "工数区分定義登録 - 業務工数システム",
      "/def-list": "工数区分定義一覧 - 業務工数システム",
      "/def-update/:id": "工数区分定義編集 - 業務工数システム",
      "/def-ver": "工数区分定義切り替え - 業務工数システム",
      "/member-menu": "人員Menu - 業務工数システム",
      "/member-new": "人員登録 - 業務工数システム",
      "/member-list": "人員一覧 - 業務工数システム",
      "/member-update/:employee_no": "人員編集 - 業務工数システム",
      "/member-delete/:employee_no": "人員削除 - 業務工数システム",
    };

    // URLに基づいてタイトルを設定
    document.title = routeTitles[location.pathname] || "業務工数システム";
  }, [location]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<MainMenu />} />
      <Route path="/def-menu" element={<DefMenu />} />
      <Route path="/def-search" element={<DefSearch />} />
      <Route path="/def-new" element={<DefNew />} />
      <Route path="/def-list" element={<DefList />} />
      <Route path="/def-update/:id" element={<DefEdit />} />
      <Route path="/def-ver" element={<DefVer />} />
      <Route path="/member-menu" element={<MemberMenu />} />
      <Route path="/member-new" element={<MemberNew />} />
      <Route path="/member-list" element={<MemberList />} />
      <Route path="/member-update/:employee_no" element={<MemberEdit />} />
      <Route path="/member-delete/:employee_no" element={<MemberDelete />} />
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