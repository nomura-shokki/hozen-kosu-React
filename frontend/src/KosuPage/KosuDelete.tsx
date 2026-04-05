import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import Loading from "../Components/Loading";
import KosuDisplay from "../Components/KosuDisplay";
import KosuBarChart from "../Components/KosuBarChart"; 
import DefTable from "../Components/DefTable";
import styles from "../styles/KosuPage/KosuDelete.module.css";

interface Kosu {
  id: string;
  employee_no3: number;
  work_day2: string;
  tyoku2: string;
  time_work: string;
  detail_work: string;
  over_time: number;
  work_time: string;
  def_ver2: string;
  judgement: boolean;
  break_change: boolean;
}

interface DefData {
  [key: string]: string | undefined;
}

const KosuDelete: React.FC = () => {
  const [defData, setDefData] = useState<DefData>({});
  const navigate = useNavigate();
  const [record, setRecord] = useState<Kosu | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const [initialTimeWork, setInitialTimeWork] = useState<string | null>(null);
  const [initialWorkDetail, setInitialWorkDetail] = useState<string | null>(null);
  const [initialTyoku, setInitialTyoku] = useState<string | null>(null);
  const [memberShop, setMemberShop] = useState<string>("");
  const tableRef = useRef<HTMLTableElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>(window.innerHeight);
  const [tableWidth, setTableWidth] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/api/kosu_update/${id}/`);
        const { kosu_data, member_data, def_data } = response.data;

        setRecord(kosu_data);
        setDefData(def_data);
        setMemberShop(member_data.shop);
        setInitialTimeWork(kosu_data.time_work);
        setInitialWorkDetail(kosu_data.detail_work);
        setInitialTyoku(kosu_data.tyoku2);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) navigate("/login");
          else if (err.response?.status === 403) navigate("/");
          else setError(err.response?.data.message);
        } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    const updateMaxHeight = () => {
      const headerHeight = (document.querySelector("h1") as HTMLElement)?.offsetHeight || 0;
      setMaxHeight(window.innerHeight - headerHeight - 40);
    };

    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth + 5);
      }
    };

    updateMaxHeight();
    updateTableWidth();

    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("resize", updateTableWidth);
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("resize", updateTableWidth);
    };
  }, [record]);

  const handleDelete = async () => {
    const confirmed = confirm("削除すると戻せません。削除しますか？");
    if (!confirmed) return;

    try {
      await api.delete(`/api/kosu_delete/${id}/`);
      alert("削除が完了しました");
      navigate("/kosu-list");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    }
  };

  const tyokuMapping: { [key: string]: string } = {
    "1": "1直",
    "2": "2直",
    "3": "3直",
    "4": "常昼",
    "5": "連1直",
    "6": "連2直",
  };

  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (error) return <div>Error: {error}</div>;
  if (!record) return <div>データが見つかりません</div>;

  return (
    <>
      <div className={styles["kosu-delete-wrapper"]}>   
        <h1 className={styles["h1-collar"]}>工数データ削除</h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-list">工数履歴</Link>
        </nav>
        <p>以下の工数データを削除しますか？</p>

        <button onClick={handleDelete} className="light_blue_button">
          削除
        </button>

        <div
          className={styles["table-wrapper"]}
          style={{
            maxHeight: `${maxHeight}px`,
            width: `${tableWidth}px`,
            overflowY: "auto",
          }}
        >
          <table ref={tableRef}>
            <tbody>
              <tr>
                <th className={styles["th-collar"]}>就業日</th>
                <td>{record.work_day2}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>整合性</th>
                <td style={{ color: record.judgement ? "blue" : "red", marginLeft: "8px" }}>
                  {record.judgement ? "OK" : "NG"}
                </td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>直</th>
                <td>{tyokuMapping[record.tyoku2] || ""}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>勤務</th>
                <td>{record.work_time}</td>
              </tr>
              <tr>
                <th className={styles["th-collar"]}>残業時間</th>
                <td>{record.over_time}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles["centeredContainer"]}>
          <KosuDisplay timeWork={initialTimeWork || ""} updatedAt={new Date()} workDetail={initialWorkDetail || ""}  defData={defData} tyoku={initialTyoku || ""} shop={memberShop || ""} headerColor="#0ff" />
          <KosuBarChart initialTimeWork={initialTimeWork} tyoku={initialTyoku || ""} shop={memberShop || ""} />
          <DefTable defData={defData} />
        </div>
      </div>
    </>
  );
};

export default KosuDelete;