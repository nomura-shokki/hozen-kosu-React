import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import api from "../api/axios";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/TeamPage/TeamNew.module.css";
import TeamMemberSelect from "../Components/TeamMemberSelect";
import ShopSelect from "../Components/ShopSelect";
import Loading from "../Components/Loading";

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
  shop1: string;
  shop2: string;
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
    shop1: "",
    shop2: "",
    follow: false,
  });

  const [teamMemberOptions, setTeamMemberOptions] = useState<{ employee_no: number; name: string; shop: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loggedInShop, setLoggedInShop] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get("/api/team_new/");
        const memberSelectData =
          response.data.member_select.map(
            (member: { employee_no: number; name: string; shop: string }) => ({
              employee_no: member.employee_no,
              name: member.name,
              shop: member.shop,
            })
          ) ?? [];
        setTeamMemberOptions(memberSelectData);

        const loggedInEmployeeNo = response.data.member_data.employee_no;
        const loggedInShop = response.data.member_data.shop;
        setLoggedInShop(loggedInShop);
        const teamDefaultData = response.data.member_default;
        const teamFollow = response.data.team_data.follow;

        const initialFields: any = { 
          employee_no5: loggedInEmployeeNo, 
          follow: teamFollow,
          shop1: "",
          shop2: "",
        };

        teamDefaultData.forEach((member: { employee_no: number }, index: number) => {
          const memberKey = `member${index + 1}` as keyof FormData;
          initialFields[memberKey] = String(member.employee_no);
        });

        setFormData((prevFormData) => {
          for (let i = 1; i <= 15; i++) {
            const memberKey = `member${i}` as keyof FormData;
            if (!initialFields[memberKey]) {
              initialFields[memberKey] = "";
            }
          }

          return {
            ...prevFormData, 
            ...initialFields,
            shop1: "", 
            shop2: "", 
          };
        });
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await api.post("/api/team_new/", formData);
      navigate("/team-menu");
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

  const renderMemberSelects = () => {
    const selects = [];
    const selectedShops = [formData.shop1, formData.shop2].filter(Boolean);

    const filteredMemberOptions = teamMemberOptions.filter((member) =>
      selectedShops.length === 0 || selectedShops.includes(member.shop)
    );

    for (let i = 1; i <= 15; i++) {
      const memberName = `member${i}` as keyof FormData;
      const memberId = `member-select-${i}`;

      selects.push(
        <React.Fragment key={i}>
          <label htmlFor={memberId}>メンバー{i}:</label>
          <TeamMemberSelect
            id={memberId}
            name={memberName}
            value={formData[memberName] as string}
            onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
            options={filteredMemberOptions}
          />
        </React.Fragment>
      );
    }
    return selects;
  };

  const shopsWithFilter = ["組長以上(P,R,T,その他)", "組長以上(W,A)"];

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (errorMessage) return <div>Error: {errorMessage}</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["team-new-wrapper"]}>
        <h1 className={styles["h1-collar"]}>班員登録</h1>
        <nav className={styles["team-nav"]}>
          <Link to="/team-menu">班員MENU</Link>
        </nav>

        {errorMessage && <div role="alert">{errorMessage}</div>}
        {loggedInShop && shopsWithFilter.includes(loggedInShop) && (
          <div className={styles["paling"]}>
            <div className={styles["search-bar"]}>
              <div className={styles["shop-label-wrapper"]}>
                <label>ショップ絞り込み:</label>
              </div>
              <div className={styles["shop-select-container"]}>
                <ShopSelect
                  id="shop-select-1"
                  name="shop1"
                  value={formData.shop1}
                  onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
                />
                <ShopSelect
                  id="shop-select-2"
                  name="shop2"
                  value={formData.shop2}
                  onChange={(event) => handleChange(event as ChangeEvent<HTMLSelectElement>)}
                />
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={styles["form-width"]}
        >
          <div className={styles["search-bar"]}>
            <div className={styles["switch-wrapper"]}>
              <label htmlFor="follow-checkbox">フォローON/OFF:</label>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  id="follow-checkbox"
                  name="follow"
                  checked={formData.follow}
                  onChange={handleChange}
                />
                <span className={styles["toggle-slider"]}></span>
              </label>
            </div>

            {renderMemberSelects()}

            <button type="submit" className="orange_button">
              登録
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TeamNew;