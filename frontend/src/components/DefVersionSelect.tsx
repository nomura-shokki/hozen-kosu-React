import React from "react";

// 親コンポーネントから渡されるPropsの型
interface DefVersionSelectProps {
  id?: string;
  choices: {
    id: number;
    kosu_name: string;
  }[];
  selectedVersion: string;
  setSelectedVersion: (version: string) => void;
}

const DefVersionSelect: React.FC<DefVersionSelectProps> = ({
  id = "versionchoice",
  choices,
  selectedVersion,
  setSelectedVersion,
}) => {
  return (
    <select
      id={id}
      name={id}
      value={selectedVersion}
      onChange={(e) => setSelectedVersion(e.target.value)}
    >
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