import React, { ChangeEvent } from "react";

interface TeamMemberSelectProps {
  id?: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: { employee_no: number; name: string }[];
}

const TeamMemberSelect: React.FC<TeamMemberSelectProps> = ({ id, name, value, onChange, options }) => {
  return (
    <select id={id} name={name} value={value} onChange={onChange}>
      <option value="">-- 人員選択 --</option>
      {options.map((option) => (
        <option key={option.employee_no} value={option.employee_no}>
          {option.employee_no} - {option.name}
        </option>
      ))}
    </select>
  );
};

export default TeamMemberSelect;