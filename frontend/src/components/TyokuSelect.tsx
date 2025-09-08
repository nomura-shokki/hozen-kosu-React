import React from "react";
import styles from "../styles/components/TyokuSelect.module.css";

interface TyokuSelectProps {
  id: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
}

const tyokuOptions = [
  { value: "", label: "選択してください" },
  { value: "1", label: "1直" },
  { value: "2", label: "2直" },
  { value: "3", label: "3直" },
  { value: "4", label: "常昼" },
  { value: "5", label: "1直(連2)" },
  { value: "6", label: "2直(連2)" },
];

const TyokuSelect: React.FC<TyokuSelectProps> = ({ id, value, onChange, disabled }) => (
  <select 
    id={id}
    name="tyoku2" 
    value={value} 
    className={styles["form-width"]} 
    onChange={onChange}
    disabled={disabled}
  >
    {tyokuOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default TyokuSelect;