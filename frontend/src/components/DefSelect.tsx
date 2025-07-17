import React from "react";

interface SelectProps {
  defData: { [key: string]: string | undefined };
}

const DefSelect: React.FC<SelectProps> = ({ defData }) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";

  const defDataEntries = Object.keys(defData)
    .filter((key) => key.startsWith("kosu_title_"))
    .map((key, index) => ({
      label: defData[key],
      value: alphabet[index],
    }))
    .filter(({ label }) => label);

  return (
    <>
      {defDataEntries.map(({ label, value }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
      <option key="#" value="#">
        休憩
      </option>
    </>
  );
};

export default DefSelect;
