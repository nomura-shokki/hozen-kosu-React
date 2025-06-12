import React from "react";

interface ShopSelectProps {
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const ShopSelect: React.FC<ShopSelectProps> = ({ name, value, onChange }) => {
  const shopList = [
    "P",
    "R",
    "W1",
    "W2",
    "T1",
    "T2",
    "A1",
    "A2",
    "J",
    "その他",
    "組長以上(P,R,T,その他)",
    "組長以上(W,A)",
    "異動・退社",
  ];

  return (
    <select id={name} name={name} value={value} onChange={onChange} className="form-select">
      <option value="">選択してください</option>
      {shopList.map((shop) => (
        <option key={shop} value={shop}>
          {shop}
        </option>
      ))}
    </select>
  );
};

export default ShopSelect;