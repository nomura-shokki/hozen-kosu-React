import React from "react";

// Propsの型定義を行う部分。DefSelectPropsインターフェースは、コンポーネントに渡されるプロパティを型安全に扱うためのもの。
interface DefSelectProps {
  value: string; // セレクトボックスの現在の選択値
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // 値変更時のコールバック関数
  defData: { [key: string]: string | undefined }; // デフォルトデータのマップ。キーは文字列、値は文字列またはundefined
  className?: string; // オプションで指定可能なCSSクラス名
  name?: string; // セレクトボックスのname属性
  id?: string; // セレクトボックスのid属性
  disabled?: boolean; // この行を追加
}

// Reactの関数コンポーネントとしてDefSelectを定義。
const DefSelect: React.FC<DefSelectProps> = ({
  value,
  onChange,
  defData,
  className = "form-select", // classNameのデフォルト値を設定
  name = "time_work", // name属性のデフォルト値を設定
  id = "time_work", // id属性のデフォルト値を設定
  disabled = false, // この行を追加
}) => {
  // A～Z、a～xまでの英字を格納した文字列。オプションのvalue値として利用。
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";

  // defDataオブジェクトのキーから"kosu_title_"で始まるものをフィルタリングし、
  // それに対応するラベルとアルファベットを使用してオプションリストを生成。
  const defOptions = Object.keys(defData)
    .filter((key) => key.startsWith("kosu_title_")) // キーが"kosu_title_"で始まるもののみ取得
    .map((key, index) => ({
      value: alphabet[index], // アルファベット順でvalueを設定
      label: defData[key] || "", // データが存在しない場合は空文字に
    }))
    .filter(({ label }) => label !== ""); // ラベルが空でないもののみ残す

  // オプションリストに固定値として「休憩」を追加。
  defOptions.push({ value: "$", label: "休憩" });

  // JSXを返す部分。セレクトボックスの構造を定義。
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className={className}
      disabled={disabled}
    >
      <option value="">---</option>
      {defOptions.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
};

export default DefSelect; // このコンポーネントをエクスポートして外部で利用可能にする