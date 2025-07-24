import React from "react";

interface DefSelectProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  defData: { [key: string]: string | undefined };
  className?: string;
  name?: string;
  id?: string;
}

const DefSelect: React.FC<DefSelectProps> = ({
  value,
  onChange,
  defData,
  className = "form-select",
  name = "time_work",
  id = "time_work",
}) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";

  const defOptions = Object.keys(defData)
    .filter((key) => key.startsWith("kosu_title_"))
    .map((key, index) => ({
      value: alphabet[index],
      label: defData[key] || "",
    }))
    .filter(({ label }) => label !== "");

  defOptions.push({ value: "#", label: "休憩" });

  return (
    <select id={id} name={name} value={value} onChange={onChange} className={className}>
      <option value="">選択してください</option>
      {defOptions.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
};

export default DefSelect;