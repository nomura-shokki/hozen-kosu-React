import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/TeamPage/TeamNew.module.css";
import TeamMemberSelect from "../components/TeamMemberSelect";

// フォームで取り扱うデータ型を定義
interface FormData {
  employee_no5: number;
  member1: string;
  member2: string;
  member3: string;
  member4: string;
  member5: string;
  member6: string;
  member7: string;
  member8: string;
  member9: string;
  member10: string;
  member11: string;
  member12: string;
  member13: string;
  member14: string;
  member15: string;
  follow: boolean;
}

const TeamNew: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    employee_no5: 0,
    member1: "",
    member2: "",
    member3: "",
    member4: "",
    member5: "",
    member6: "",
    member7: "",
    member8: "",
    member9: "",
    member10: "",
    member11: "",
    member12: "",
    member13: "",
    member14: "",
    member15: "",
    follow: false,
  });

  const [teamMemberOptions, setTeamMemberOptions] = useState<{ employee_no: number; name: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/team_new/`, { withCredentials: true })
      .then((response) => {
        // member_selectをTeamMemberSelectコンポーネントの選択肢として使用
        const memberSelectData = response.data.member_select.map(
          (member: { employee_no: number; name: string }) => ({
            employee_no: member.employee_no,
            name: member.name,
          })
        ) ?? [];
        console.log(memberSelectData);
        setTeamMemberOptions(memberSelectData);

        const loggedInEmployeeNo = response.data.member_data.employee_no;
        const teamDefaultData = response.data.member_default;
        const teamFollow = response.data.team_data.follow; // 追加: team_data.followを取得

        // 既存のメンバーの初期値を設定
        const initialFormData: any = { ...formData, employee_no5: loggedInEmployeeNo, follow: teamFollow }; // 変更: followの初期値を設定
        teamDefaultData.forEach((member: { employee_no: number }, index: number) => {
          const memberKey = `member${index + 1}` as keyof FormData;
          initialFormData[memberKey] = String(member.employee_no);
        });

        setFormData(initialFormData);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login");
        } else if (err.response?.status === 403) {
          navigate("/");
        } else {
          console.error("不明なエラー:", err);
          setErrorMessage("データ取得中にエラーが発生しました。");
        }
      });
  }, [navigate]);

  // 入力項目が変更されたときの処理
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    if (type === "checkbox") {
      const { checked } = event.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // フォーム送信時の処理
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    axios
      .post(`${process.env.REACT_APP_API_BASE_URL}/api/team_new/`, formData, { withCredentials: true })
      .then(() => {
        alert("データが更新されました！");
        navigate("/team-menu");
      })
      .catch((error) => {
        console.error(error);
        if (error.response && error.response.data) {
          const errors = error.response.data;
          const errorMessages = Object.keys(errors)
            .map((key) => `${key}: ${errors[key]}`)
            .join("\n");
          setErrorMessage(errorMessages);
        } else {
          setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
        }
      });
  };

  // メンバー選択コンポーネントの動的生成
  const renderMemberSelects = () => {
    const selects = [];
    for (let i = 1; i <= 15; i++) {
      const memberName = `member${i}` as keyof FormData;
      selects.push(
        <React.Fragment key={i}>
          <label htmlFor={memberName}>メンバー{i}:</label>
          <TeamMemberSelect
            name={memberName}
            value={formData[memberName] as string}
            onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
            options={teamMemberOptions}
          />
        </React.Fragment>
      );
    }
    return selects;
  };

  return (
    <div className={styles["team-new-wrapper"]}>
      <h1 className={styles["h1-collar"]}>班員登録</h1>
      <nav className={styles["team-nav"]}>
        <Link to="/team-menu">班員MENU</Link>
      </nav>

      {errorMessage && <div role="alert">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles["search-bar"]}>
          <div className={styles["switch-wrapper"]}>
            <label htmlFor="follow">フォローON/OFF:</label>
            <label className={styles["toggle-switch"]}>
              <input
                type="checkbox"
                id="follow"
                name="follow"
                checked={formData.follow}
                onChange={handleChange}
              />
              <span className={styles["toggle-slider"]}></span>
            </label>
          </div>
          
          {renderMemberSelects()}
          
          <button type="submit" className="yellow_button">
            登録
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamNew;