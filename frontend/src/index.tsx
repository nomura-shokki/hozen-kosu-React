import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainMenu from './MainPage/MainMenu';
import MemberMenu from './MemberPage/MemberMenu';
import MemberNew from './MemberPage/MemberNew';
import MemberList from './MemberPage/MemberList';
import MemberEdit from './MemberPage/MemberEdit';
import MemberDelete from './MemberPage/MemberDelete';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/member-menu" element={<MemberMenu />} />
        <Route path="/member-new" element={<MemberNew />} />
        <Route path="/member-list" element={<MemberList />} />
        <Route path="/member-updata/:employee_no" element={<MemberEdit />} />
        <Route path="/member-delete/:employee_no" element={<MemberDelete />} />
      </Routes>
    </Router>
  </React.StrictMode>
);