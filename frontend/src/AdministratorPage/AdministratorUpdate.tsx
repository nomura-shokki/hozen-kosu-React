import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import LogConsole from "../Components/LogConsole";
import styles from "../styles/AdministratorPage/AdministratorUpdate.module.css";



const LOG_CONSOLE_VISIBILITY_KEY = "showLogConsole";

interface Admin {
  menu_row: number;
  administrator_employee_no1: number | null; 
  administrator_employee_no2: number | null;
  administrator_employee_no3: number | null;
}

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
}

interface Response {
  admin_data: Admin;
  login_data: Member;
}

const AdminUpdate: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Admin | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLogConsole, setShowLogConsole] = useState<boolean>(() => {
    const cachedValue = localStorage.getItem(LOG_CONSOLE_VISIBILITY_KEY);
    return cachedValue === 'true'; 
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<Response>(`${process.env.REACT_APP_API_BASE_URL}/api/manager_update/`, { withCredentials: true });
        const { admin_data } = response.data;
        setFormData(admin_data);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setErrorMessage(err.response?.data.message);
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem(LOG_CONSOLE_VISIBILITY_KEY, String(showLogConsole));
  }, [showLogConsole]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox && (event.target as HTMLInputElement).checked;

    if (name === LOG_CONSOLE_VISIBILITY_KEY && isCheckbox) {
      setShowLogConsole(checked);
      return;
    }

    const isNumberField = [
      "menu_row",
      "administrator_employee_no1",
      "administrator_employee_no2",
      "administrator_employee_no3",
    ].includes(name);

    const newValue = isNumberField
      ? value === ""
        ? null
        : parseInt(value, 10)
      : value;

    setFormData((prevData) => {
      if (!prevData) return null;
      return {
        ...prevData,
        [name]: newValue,
      } as Admin;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!formData) return;

    if (formData.menu_row === null || formData.menu_row <= 0) {
      setErrorMessage("一覧表示項目数は自然数で入力してください。");
      return;
    }

    const employeeNumbers = [
      { key: "administrator_employee_no1", label: "担当者1" },
      { key: "administrator_employee_no2", label: "担当者2" },
      { key: "administrator_employee_no3", label: "担当者3" },
    ] as const;

    for (const field of employeeNumbers) {
      const val = formData[field.key];
      if (val !== null && val <= 0) {
        setErrorMessage(`問い合わせ担当者従業員番号${field.label.slice(-1)}は自然数で入力してください。`);
        return;
      }
    }

    try {
      await axios.put(`${process.env.REACT_APP_API_BASE_URL}/api/manager_update/`, formData, { withCredentials: true });
      alert("登録完了！");
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else setErrorMessage(err.response?.data.message);
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (!formData) return <div>データが見つかりません</div>;

  return (
    <div className={styles["page-container"]}>
      <Loading isLoading={loading} />
      <div className={styles["admin-update-wrapper"]}>
        <h1 className={styles["h1-collar"]}>設定編集</h1>
        <nav className={styles["admin-nav"]}>
          <Link to="/manager-menu">管理者MENU</Link>
        </nav>

      {errorMessage && (
        <div role="alert">{errorMessage}</div>
      )}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            <label htmlFor="menu_row">一覧表示項目数：</label>
            <input
              id="menu_row"
              name="menu_row"
              type="number"
              value={formData.menu_row}
              onChange={handleChange}
            />
            <label htmlFor="administrator_employee_no1">問い合わせ担当者従業員番号1：</label>
            <input
              id="administrator_employee_no1"
              name="administrator_employee_no1"
              type="number"
              value={formData.administrator_employee_no1 ?? ""}
              onChange={handleChange}
            />
            <label htmlFor="administrator_employee_no2">問い合わせ担当者従業員番号2：</label>
            <input
              id="administrator_employee_no2"
              name="administrator_employee_no2"
              type="number"
              value={formData.administrator_employee_no2 ?? ""}
              onChange={handleChange}
            />
            <label htmlFor="administrator_employee_no3">問い合わせ担当者従業員番号3：</label>
            <input
              id="administrator_employee_no3"
              name="administrator_employee_no3"
              type="number"
              value={formData.administrator_employee_no3 ?? ""}
              onChange={handleChange}
            />

            <div className={styles["switch-wrapper"]}>
              <label htmlFor={LOG_CONSOLE_VISIBILITY_KEY}>バックエンドログ表示:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id={LOG_CONSOLE_VISIBILITY_KEY}
                  name={LOG_CONSOLE_VISIBILITY_KEY}
                  checked={showLogConsole}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>
            <button type="submit" className="gray_button">編集</button>
          </div>
        </form>
      </div>
      {showLogConsole && <LogConsole />}
    </div>
  );
};

export default AdminUpdate;