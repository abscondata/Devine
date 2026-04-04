"use client";

import { Streamdown } from "streamdown";
import type { ComponentProps } from "react";

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export function MessageResponse({ className, ...props }: MessageResponseProps) {
  return (
    <Streamdown
      className={`markdown ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
