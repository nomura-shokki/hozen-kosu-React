import React from "react";

interface ShopSelectProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  name?: string;
  id?: string;
}

const contentOptions = [
  { value: "", label: "---" },
  { value: "要望", label: "要望" },
  { value: "不具合", label: "不具合" },
  { value: "問い合わせ", label: "問い合わせ" },
];

const ContentSelect: React.FC<ShopSelectProps> = ({
  value,
  onChange,
  className = "form-select",
  name = "content",
  id = "content",
}) => (
  <select id={id} name={name} value={value} onChange={onChange} className={className}>
    {contentOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default ContentSelect;