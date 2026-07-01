import React from "react";
import styles from "../styles/Components/WorkSelect.module.css";

interface WorkSelectProps {
  id: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  mode?: "ALL" | "LIMIT";
}

const limitedWorkOptions = [
  { value: "", label: "---" },
  { value: "出勤", label: "出勤" },
  { value: "シフト出", label: "シフト出" },
  { value: "休出", label: "休出" },
  { value: "半前年休", label: "半前年休" },
  { value: "半後年休", label: "半後年休" },
  { value: "出勤(時短なし)", label: "出勤(時短なし)" },
  { value: "半前年休(時短なし)", label: "半前年休(時短なし)" },
  { value: "半後年休(時短なし)", label: "半後年休(時短なし)" },
  { value: "早退・遅刻", label: "早退・遅刻" },
];

const allWorkOptions = [
  ...limitedWorkOptions,
  { value: "休日", label: "休日" },
  { value: "年休", label: "年休" },
  { value: "公休", label: "公休" },
  { value: "シフト休", label: "シフト休" },
  { value: "代休", label: "代休" },
  { value: "欠勤", label: "欠勤" },
];

const WorkSelect: React.FC<WorkSelectProps> = ({ id, value, onChange, disabled, mode = "LIMIT" }) => {
  const workOptions = mode === "ALL" ? allWorkOptions : limitedWorkOptions;

  return (
    <select
      id={id}
      name="work_time"
      value={value}
      className={styles["form-width"]}
      onChange={onChange}
      disabled={disabled}
    >
      {workOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default WorkSelect;