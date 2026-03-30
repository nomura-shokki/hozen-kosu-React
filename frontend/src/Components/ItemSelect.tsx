import React from "react";

interface ItemSelectProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  name?: string;
  id?: string;
}

const Options = [
  { value: "", label: "-- 内容選択 --" },
  { value: "要望", label: "要望" },
  { value: "不具合", label: "不具合" },
  { value: "問い合わせ", label: "問い合わせ" },
];

const ItemSelect: React.FC<ItemSelectProps> = ({
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

export default ItemSelect;