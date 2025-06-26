import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import './styles/global.css';
import Login from './MainPage/Login';
import MainMenu from './MainPage/MainMenu';
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