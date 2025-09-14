import React, { ChangeEvent } from "react";

interface TeamMemberSelectProps {
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: { employee_no: number; name: string }[];
}

const TeamMemberSelect: React.FC<TeamMemberSelectProps> = ({ name, value, onChange, options }) => {
  return (
    <select name={name} value={value} onChange={onChange}>
      <option value="">-- 選択 --</option>
      {options.map((option) => (
        <option key={option.employee_no} value={option.employee_no}>
          {option.employee_no} - {option.name}
        </option>
      ))}
    </select>
  );
};

export default TeamMemberSelect;