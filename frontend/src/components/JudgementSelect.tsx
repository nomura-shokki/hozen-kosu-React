import React from "react";

interface ItemSelectProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  name?: string;
  id?: string;
}

const Options = [
  { value: "", label: "---" },
  { value: "OK", label: "OK" },
  { value: "NG", label: "NG" },
];

const JudgementSelect: React.FC<ItemSelectProps> = ({
  value,
  onChange,
  className = "form-select",
  name = "Item",
  id = "Item",
}) => (
  <select id={id} name={name} value={value} onChange={onChange} className={className}>
    {Options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default JudgementSelect;