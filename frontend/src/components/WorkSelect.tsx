import React from "react";
import styles from "../styles/components/WorkSelect.module.css";

interface WorkSelectProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const workOptions = [
  { value: "", label: "選択してください" },
  { value: "出勤", label: "出勤" },
  { value: "シフト出", label: "シフト出" },
  { value: "休出", label: "休出" },
  { value: "半前年休", label: "半前年休" },
  { value: "半後年休", label: "半後年休" },
  { value: "早退・遅刻", label: "早退・遅刻" },
];

const WorkSelect: React.FC<WorkSelectProps> = ({ value, onChange }) => (
  <select id="work_time" name="work_time" value={value} className={styles["form-width"]} onChange={onChange}>
    {workOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default WorkSelect;