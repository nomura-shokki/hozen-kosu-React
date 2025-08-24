import React, { useState, useEffect, FormEvent } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MobileTimePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers";
import Loading from "../components/Loading";
import styles from "../styles/KosuPage/BreakTime.module.css";

interface Member {
  employee_no: number;
  name: string;
  shop: string;
  authority: boolean;
  administrator: boolean;
  break_time1: string | null;
  break_time1_over1: string | null;
  break_time1_over2: string | null;
  break_time1_over3: string | null;
  break_time2: string | null;
  break_time2_over1: string | null;
  break_time2_over2: string | null;
  break_time2_over3: string | null;
  break_time3: string | null;
  break_time3_over1: string | null;
  break_time3_over2: string | null;
  break_time3_over3: string | null;
  break_time4: string | null;
  break_time4_over1: string | null;
  break_time4_over2: string | null;
  break_time4_over3: string | null;
  break_time5: string | null;
  break_time5_over1: string | null;
  break_time5_over2: string | null;
  break_time5_over3: string | null;
  break_time6: string | null;
  break_time6_over1: string | null;
  break_time6_over2: string | null;
  break_time6_over3: string | null;
}

const BreakTime: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakTime1, setBreakTime1] = useState<Date | null>(null);
  const [breakTime2, setBreakTime2] = useState<Date | null>(null);
  const [breakTime3, setBreakTime3] = useState<Date | null>(null);
  const [breakTime4, setBreakTime4] = useState<Date | null>(null);
  const [breakTime5, setBreakTime5] = useState<Date | null>(null);
  const [breakTime6, setBreakTime6] = useState<Date | null>(null);
  const [breakTime7, setBreakTime7] = useState<Date | null>(null);
  const [breakTime8, setBreakTime8] = useState<Date | null>(null);
  const [breakTime9, setBreakTime9] = useState<Date | null>(null);
  const [breakTime10, setBreakTime10] = useState<Date | null>(null);
  const [breakTime11, setBreakTime11] = useState<Date | null>(null);
  const [breakTime12, setBreakTime12] = useState<Date | null>(null);
  const [breakTime13, setBreakTime13] = useState<Date | null>(null);
  const [breakTime14, setBreakTime14] = useState<Date | null>(null);
  const [breakTime15, setBreakTime15] = useState<Date | null>(null);
  const [breakTime16, setBreakTime16] = useState<Date | null>(null);
  const [breakTime17, setBreakTime17] = useState<Date | null>(null);
  const [breakTime18, setBreakTime18] = useState<Date | null>(null);
  const [breakTime19, setBreakTime19] = useState<Date | null>(null);
  const [breakTime20, setBreakTime20] = useState<Date | null>(null);
  const [breakTime21, setBreakTime21] = useState<Date | null>(null);
  const [breakTime22, setBreakTime22] = useState<Date | null>(null);
  const [breakTime23, setBreakTime23] = useState<Date | null>(null);
  const [breakTime24, setBreakTime24] = useState<Date | null>(null);
  const [breakTime25, setBreakTime25] = useState<Date | null>(null);
  const [breakTime26, setBreakTime26] = useState<Date | null>(null);
  const [breakTime27, setBreakTime27] = useState<Date | null>(null);
  const [breakTime28, setBreakTime28] = useState<Date | null>(null);
  const [breakTime29, setBreakTime29] = useState<Date | null>(null);
  const [breakTime30, setBreakTime30] = useState<Date | null>(null);
  const [breakTime31, setBreakTime31] = useState<Date | null>(null);
  const [breakTime32, setBreakTime32] = useState<Date | null>(null);
  const [breakTime33, setBreakTime33] = useState<Date | null>(null);
  const [breakTime34, setBreakTime34] = useState<Date | null>(null);
  const [breakTime35, setBreakTime35] = useState<Date | null>(null);
  const [breakTime36, setBreakTime36] = useState<Date | null>(null);
  const [breakTime37, setBreakTime37] = useState<Date | null>(null);
  const [breakTime38, setBreakTime38] = useState<Date | null>(null);
  const [breakTime39, setBreakTime39] = useState<Date | null>(null);
  const [breakTime40, setBreakTime40] = useState<Date | null>(null);
  const [breakTime41, setBreakTime41] = useState<Date | null>(null);
  const [breakTime42, setBreakTime42] = useState<Date | null>(null);
  const [breakTime43, setBreakTime43] = useState<Date | null>(null);
  const [breakTime44, setBreakTime44] = useState<Date | null>(null);
  const [breakTime45, setBreakTime45] = useState<Date | null>(null);
  const [breakTime46, setBreakTime46] = useState<Date | null>(null);
  const [breakTime47, setBreakTime47] = useState<Date | null>(null);
  const [breakTime48, setBreakTime48] = useState<Date | null>(null);
  const navigate = useNavigate();

  const handleError = (error: any, defaultMessage: string) => {
    if (error.response && error.response.data && error.response.data.error) {
      setErrorMessage(error.response.data.error);
    } else {
      setErrorMessage(defaultMessage);
    }
  };

  const parseBreakTime = (breaktime: string | null): [Date | null, Date | null] => {
    const validBreaktime = breaktime || "#00000000"; // nullならデフォルト値適用

    if (validBreaktime.length === 9 && validBreaktime.startsWith("#")) {
      const time1 = new Date();
      const time2 = new Date();

      time1.setHours(parseInt(validBreaktime.slice(1, 3), 10));
      time1.setMinutes(parseInt(validBreaktime.slice(3, 5), 10));
      time1.setSeconds(0);
      time1.setMilliseconds(0);

      time2.setHours(parseInt(validBreaktime.slice(5, 7), 10));
      time2.setMinutes(parseInt(validBreaktime.slice(7, 9), 10));
      time2.setSeconds(0);
      time2.setMilliseconds(0);

      return [time1, time2];
    }
    return [null, null];
  };

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/break_time/`, { withCredentials: true })
      .then((response) => {
        const member_data: Member = response.data.kosu_data || {
          employee_no3: 0,
          break_time1: "#00000000",
          break_time1_over1: "#00000000",
          break_time1_over2: "#00000000",
          break_time1_over3: "#00000000",
          break_time2: "#00000000",
          break_time2_over1: "#00000000",
          break_time2_over2: "#00000000",
          break_time2_over3: "#00000000",
          break_time3: "#00000000",
          break_time3_over1: "#00000000",
          break_time3_over2: "#00000000",
          break_time3_over3: "#00000000",
          break_time4: "#00000000",
          break_time4_over1: "#00000000",
          break_time4_over2: "#00000000",
          break_time4_over3: "#00000000",
          break_time5: "#00000000",
          break_time5_over1: "#00000000",
          break_time5_over2: "#00000000",
          break_time5_over3: "#00000000",
          break_time6: "#00000000",
          break_time6_over1: "#00000000",
          break_time6_over2: "#00000000",
          break_time6_over3: "#00000000",
        };

        const [initialTime1, initialTime2] = parseBreakTime(member_data.break_time1);
        setBreakTime1(initialTime1);
        setBreakTime2(initialTime2);

        const [initialTime3, initialTime4] = parseBreakTime(member_data.break_time1_over1);
        setBreakTime3(initialTime3);
        setBreakTime4(initialTime4);

        const [initialTime5, initialTime6] = parseBreakTime(member_data.break_time1_over2);
        setBreakTime5(initialTime5);
        setBreakTime6(initialTime6);

        const [initialTime7, initialTime8] = parseBreakTime(member_data.break_time1_over3);
        setBreakTime7(initialTime7);
        setBreakTime8(initialTime8);

        const [initialTime9, initialTime10] = parseBreakTime(member_data.break_time2);
        setBreakTime9(initialTime9);
        setBreakTime10(initialTime10);

        const [initialTime11, initialTime12] = parseBreakTime(member_data.break_time2_over1);
        setBreakTime11(initialTime11);
        setBreakTime12(initialTime12);

        const [initialTime13, initialTime14] = parseBreakTime(member_data.break_time2_over2);
        setBreakTime13(initialTime13);
        setBreakTime14(initialTime14);

        const [initialTime15, initialTime16] = parseBreakTime(member_data.break_time2_over3);
        setBreakTime15(initialTime15);
        setBreakTime16(initialTime16);

        const [initialTime17, initialTime18] = parseBreakTime(member_data.break_time3);
        setBreakTime17(initialTime17);
        setBreakTime18(initialTime18);

        const [initialTime19, initialTime20] = parseBreakTime(member_data.break_time3_over1);
        setBreakTime19(initialTime19);
        setBreakTime20(initialTime20);

        const [initialTime21, initialTime22] = parseBreakTime(member_data.break_time3_over2);
        setBreakTime21(initialTime21);
        setBreakTime22(initialTime22);

        const [initialTime23, initialTime24] = parseBreakTime(member_data.break_time3_over3);
        setBreakTime23(initialTime23);
        setBreakTime24(initialTime24);

        const [initialTime25, initialTime26] = parseBreakTime(member_data.break_time4);
        setBreakTime25(initialTime25);
        setBreakTime26(initialTime26);

        const [initialTime27, initialTime28] = parseBreakTime(member_data.break_time4_over1);
        setBreakTime27(initialTime27);
        setBreakTime28(initialTime28);

        const [initialTime29, initialTime30] = parseBreakTime(member_data.break_time4_over2);
        setBreakTime29(initialTime29);
        setBreakTime30(initialTime30);

        const [initialTime31, initialTime32] = parseBreakTime(member_data.break_time4_over3);
        setBreakTime31(initialTime31);
        setBreakTime32(initialTime32);

        const [initialTime33, initialTime34] = parseBreakTime(member_data.break_time5);
        setBreakTime33(initialTime33);
        setBreakTime34(initialTime34);

        const [initialTime35, initialTime36] = parseBreakTime(member_data.break_time5_over1);
        setBreakTime35(initialTime35);
        setBreakTime36(initialTime36);

        const [initialTime37, initialTime38] = parseBreakTime(member_data.break_time5_over2);
        setBreakTime37(initialTime37);
        setBreakTime38(initialTime38);

        const [initialTime39, initialTime40] = parseBreakTime(member_data.break_time5_over3);
        setBreakTime39(initialTime39);
        setBreakTime40(initialTime40);

        const [initialTime41, initialTime42] = parseBreakTime(member_data.break_time6);
        setBreakTime41(initialTime41);
        setBreakTime42(initialTime42);

        const [initialTime43, initialTime44] = parseBreakTime(member_data.break_time6_over1);
        setBreakTime43(initialTime43);
        setBreakTime44(initialTime44);

        const [initialTime45, initialTime46] = parseBreakTime(member_data.break_time6_over2);
        setBreakTime45(initialTime45);
        setBreakTime46(initialTime46);

        const [initialTime47, initialTime48] = parseBreakTime(member_data.break_time6_over3);
        setBreakTime47(initialTime47);
        setBreakTime48(initialTime48);

        setLoading(false);
      })
      .catch((error) => {
        console.error("データ取得エラー:", error);
        handleError(error, "データの取得で想定外のエラーが発生しました");
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    axios
    .post(
      `${process.env.REACT_APP_API_BASE_URL}/api/break_time/`,
      {
        breakTime1: breakTime1 ? breakTime1.toISOString() : null,
        breakTime2: breakTime2 ? breakTime2.toISOString() : null,
        breakTime3: breakTime3 ? breakTime3.toISOString() : null,
        breakTime4: breakTime4 ? breakTime4.toISOString() : null,
        breakTime5: breakTime5 ? breakTime5.toISOString() : null,
        breakTime6: breakTime6 ? breakTime6.toISOString() : null,
        breakTime7: breakTime7 ? breakTime7.toISOString() : null,
        breakTime8: breakTime8 ? breakTime8.toISOString() : null,
        breakTime9: breakTime9 ? breakTime9.toISOString() : null,
        breakTime10: breakTime10 ? breakTime10.toISOString() : null,
        breakTime11: breakTime11 ? breakTime11.toISOString() : null,
        breakTime12: breakTime12 ? breakTime12.toISOString() : null,
        breakTime13: breakTime13 ? breakTime13.toISOString() : null,
        breakTime14: breakTime14 ? breakTime14.toISOString() : null,
        breakTime15: breakTime15 ? breakTime15.toISOString() : null,
        breakTime16: breakTime16 ? breakTime16.toISOString() : null,
        breakTime17: breakTime17 ? breakTime17.toISOString() : null,
        breakTime18: breakTime18 ? breakTime18.toISOString() : null,
        breakTime19: breakTime19 ? breakTime19.toISOString() : null,
        breakTime20: breakTime20 ? breakTime20.toISOString() : null,
        breakTime21: breakTime21 ? breakTime21.toISOString() : null,
        breakTime22: breakTime22 ? breakTime22.toISOString() : null,
        breakTime23: breakTime23 ? breakTime23.toISOString() : null,
        breakTime24: breakTime24 ? breakTime24.toISOString() : null,
        breakTime25: breakTime25 ? breakTime25.toISOString() : null,
        breakTime26: breakTime26 ? breakTime26.toISOString() : null,
        breakTime27: breakTime27 ? breakTime27.toISOString() : null,
        breakTime28: breakTime28 ? breakTime28.toISOString() : null,
        breakTime29: breakTime29 ? breakTime29.toISOString() : null,
        breakTime30: breakTime30 ? breakTime30.toISOString() : null,
        breakTime31: breakTime31 ? breakTime31.toISOString() : null,
        breakTime32: breakTime32 ? breakTime32.toISOString() : null,
        breakTime33: breakTime33 ? breakTime33.toISOString() : null,
        breakTime34: breakTime34 ? breakTime34.toISOString() : null,
        breakTime35: breakTime35 ? breakTime35.toISOString() : null,
        breakTime36: breakTime36 ? breakTime36.toISOString() : null,
        breakTime37: breakTime37 ? breakTime37.toISOString() : null,
        breakTime38: breakTime38 ? breakTime38.toISOString() : null,
        breakTime39: breakTime39 ? breakTime39.toISOString() : null,
        breakTime40: breakTime40 ? breakTime40.toISOString() : null,
        breakTime41: breakTime41 ? breakTime41.toISOString() : null,
        breakTime42: breakTime42 ? breakTime42.toISOString() : null,
        breakTime43: breakTime43 ? breakTime43.toISOString() : null,
        breakTime44: breakTime44 ? breakTime44.toISOString() : null,
        breakTime45: breakTime45 ? breakTime45.toISOString() : null,
        breakTime46: breakTime46 ? breakTime46.toISOString() : null,
        breakTime47: breakTime47 ? breakTime47.toISOString() : null,
        breakTime48: breakTime48 ? breakTime48.toISOString() : null,
      },
      { withCredentials: true }
    )
    .then(() => {
      alert("変更完了！");
      navigate("/kosu-new");
    })
    .catch((error) => {
      console.error(error);
      if (error.response && error.response.data) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      }
    });
  };

  return (
    <>
      <Loading isLoading={loading} />
      <div className={styles["today-brea-time-wrapper"]}>
        <h1 className={styles["h1-collar"]}>
          休憩時間変更
        </h1>
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-new">工数入力</Link>
        </nav>
        <p>
          指定した休憩時間に入っている工数は<br />
          休憩時間に置き換わり消えます
        </p>

        {errorMessage && <div role="alert">{errorMessage}</div>}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              e.target instanceof HTMLInputElement &&
              e.target.type !== "textarea"
            ) {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            <label>昼休憩:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime1}
                  onChange={(newValue) => setBreakTime1(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
              <span>〜</span>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime2}
                  onChange={(newValue) => setBreakTime2(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <label>残業休憩1:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime3}
                  onChange={(newValue) => setBreakTime3(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
              <span>〜</span>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime4}
                  onChange={(newValue) => setBreakTime4(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <label>残業休憩2:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime5}
                  onChange={(newValue) => setBreakTime5(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
              <span>〜</span>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime6}
                  onChange={(newValue) => setBreakTime6(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <label>残業休憩3:</label>
            <div className={styles["time-picker-wrapper"]}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime7}
                  onChange={(newValue) => setBreakTime7(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
              <span>〜</span>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MobileTimePicker
                  className={styles["time-picker"]}
                  value={breakTime8}
                  onChange={(newValue) => setBreakTime8(newValue)}
                  ampm={false}
                  minutesStep={5}
                  onAccept={() => {
                    const rootElement = document.getElementById("root");
                    if (rootElement) rootElement.removeAttribute("aria-hidden");
                  }}
                />
              </LocalizationProvider>
            </div>
            <button type="submit" className="light_blue_button">登録</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default BreakTime;