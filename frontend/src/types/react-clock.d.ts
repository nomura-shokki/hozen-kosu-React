declare module "react-clock" {
  import * as React from "react";

  export interface ClockProps {
    value: Date;
    renderNumbers?: boolean;
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }

  const Clock: React.FC<ClockProps>;

  export default Clock;
}
