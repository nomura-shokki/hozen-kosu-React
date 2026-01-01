import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ItemSelect from "../Components/ItemSelect";
import TeamMemberSelect from "../Components/TeamMemberSelect";
import TableContainer from "../Components/TableContainer";
import Pagination from "../Components/Pagination";
import Loading from "../Components/Loading";
import styles from "../styles/InquirPage/InquirList.module.css";

interface Inquir {
  id: number;
  employee_no2: number;
  name: string;
  content_choice: string;
  inquiry: string;
  answer: string;
}

interface InquirMember {
  id: number;
  employee_no: number;
  name: string;
}

const InquirList: React.FC = () => {
  const [data, setData] = useState<Inquir[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [MemberOptions, setMemberOptions] = useState<InquirMember[]>([]);
  const [searchItemInput, setSearchItemInput] = useState<string>("");
  const [searchItem, setSearchItem] = useState<string>("");
  const [selectedMemberInput, setSelectedMemberInput] = useState<string>("");
  const [searchMemberId, setSearchMemberId] = useState<string>("");
  const location = useLocation();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/inquir_list/`, {
        params: {
          page: currentPage,
          ...(searchMemberId && {
            member_id: searchMemberId,
          }),
          ...(searchItem && {
            item: searchItem,
          }),
        },
        withCredentials: true,
      });

      const paginationData = response.data?.inquir_data || {};
      const results = paginationData.results || [];
      const pageSize = paginationData.page_size || 20;
      const memberOptions = response.data?.member_data || [];
      const memberNameMap: { [key: number]: string } = {};
      memberOptions.forEach((member: InquirMember) => {
        memberNameMap[member.employee_no] = member.name;
      });

      const transformedData = results.map((item: Inquir) => ({
        ...item,
        name: memberNameMap[item.employee_no2] || `Unknown (${item.employee_no2})`,
      }));
      setData(transformedData);
      setMemberOptions(memberOptions);
      setTotalPages(Math.ceil(paginationData.count / pageSize));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) navigate("/login");
        else if (err.response?.status === 403) navigate("/");
        else setError(err.response?.data.message);
      } else setError("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      setLoading(false);
    }
  }, [currentPage, navigate, searchMemberId, searchItem]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedMemberInput("");
    setSearchMemberId("");
    setSearchItemInput("");
    setSearchItem("");
  }, [location.pathname]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    const isMemberChanged = selectedMemberInput !== searchMemberId;
    const isItemChanged = searchItemInput !== searchItem;
    
    if (currentPage !== 1) {
      setCurrentPage(1); 
    } else if (isMemberChanged || isItemChanged) {
      setSearchMemberId(selectedMemberInput);
      setSearchItem(searchItemInput);
    }
  };

  const handleMemberChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMemberInput(event.target.value);
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div><Loading isLoading={loading} /></div>;
  if (!data) return <div>データが見つかりません</div>;

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["inquir-list-wrapper"]}>
        <h1 className={styles["h1-collar"]}>問い合わせ履歴</h1>
        <nav className={styles["inquir-nav"]}>
          <Link to="/inquir-menu">問い合わせMENU</Link>
        </nav>
        <div className={styles["search-bar"]}>
          <label htmlFor="team-member-select"></label>
          <TeamMemberSelect
            id="team-member-select"
            name="team-member-select"
            value={selectedMemberInput}
            onChange={handleMemberChange}
            options={MemberOptions}
          />
          <label htmlFor="ItemSelect"></label>
          <ItemSelect
            id="ItemSelect"
            name="ItemSelect"
            value={searchItemInput}
            onChange={(e) => setSearchItemInput(e.target.value)}
          />
          <button onClick={handleSearch} className="pink_button">検索</button>
        </div>
        {data.length === 0 && !loading ? (
          <p>No data found.</p>
        ) : (
          <TableContainer 
            searchBarSelector={`.${styles["search-bar"]}`}
            headerSelector={`.${styles["h1-collar"]}`}
          >
            <table>
              <thead>
                <tr>
                  <th className={styles["th-collar"]}>No.</th>
                  <th className={styles["th-collar"]}>問い合わせ者</th>
                  <th className={styles["th-collar"]}>内容</th>
                  <th className={styles["th-collar"]}>問い合わせ</th>
                  <th className={styles["th-collar"]}>回答</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td><Link to={`/inquir-detail/${item.id}`} className={styles["a-collar"]}>{item.name}</Link></td>
                    <td>{item.content_choice}</td>
                    <td>{(item.inquiry || "").length > 3 ? item.inquiry.substring(0, 3) + "..." : item.inquiry}</td>
                    <td>{(item.answer || "").length > 3 ? item.answer.substring(0, 3) + "..." : item.answer}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              buttonColor="#ff69b4"
              hoverColor="#ff1493"
            />

          </TableContainer>
        )}
      </div>
    </>
  );
};

export default InquirList;