import React from "react";

interface ShopSelectProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  name?: string;
  id?: string;
}

// value と label を分けた選択肢リスト
const shopOptions = [
  { value: "", label: "---" },
  { value: "P", label: "P" },
  { value: "R", label: "R" },
  { value: "W1", label: "W1" },
  { value: "W2", label: "W2" },
  { value: "T1", label: "T1" },
  { value: "T2", label: "T2" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "J", label: "J" },
  { value: "その他", label: "その他" },
  { value: "組長以上(P,R,T,その他)", label: "組長以上(P,R,T,その他)" },
  { value: "組長以上(W,A)", label: "組長以上(W,A)" },
  { value: "異動・退社", label: "異動・退社" },
];

const ShopSelect: React.FC<ShopSelectProps> = ({
  value,
  onChange,
  className = "form-select",
  name = "shop",
  id = "shop",
}) => (
  <select id={id} name={name} value={value} onChange={onChange} className={className}>
    {shopOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default ShopSelect;