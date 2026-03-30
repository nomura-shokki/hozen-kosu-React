import React, { ChangeEvent } from "react";

// 親コンポーネントから渡されるPropsの型
interface DefVersionSelectProps {
  id?: string;
  choices: {
    id: number;
    kosu_name: string;
  }[];
  selectedVersion: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void; 
}

const DefVersionSelect: React.FC<DefVersionSelectProps> = ({
  id = "versionchoice",
  choices,
  selectedVersion,
  onChange, // PropsとしてonChangeを受け取る
}) => {
  return (
    <select
      id={id}
      name={id}
      value={selectedVersion}
      onChange={onChange}
    >
      <option value="">---</option>
      {choices.length > 0 ? (
        choices.map((choice) => (
          <option key={choice.id} value={choice.kosu_name}>
            {choice.kosu_name}
          </option>
        ))
      ) : (
        <option disabled>選択肢が取得できません</option>
      )}
    </select>
  );
};

export default DefVersionSelect;