import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from './App';
import DataList from './DataList';
import EditForm from './EditForm';
import DeletePage from './DeletePage';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/data-list" element={<DataList />} />
        <Route path="/edit/:employee_no" element={<EditForm />} />
        <Route path="/delete/:employee_no" element={<DeletePage />} />
      </Routes>
    </Router>
  </React.StrictMode>
);