declare module "streamdown" {
  import type { ComponentType, HTMLAttributes } from "react";

  export interface StreamdownProps extends HTMLAttributes<HTMLDivElement> {
    children?: string;
  }

  export const Streamdown: ComponentType<StreamdownProps>;
}
