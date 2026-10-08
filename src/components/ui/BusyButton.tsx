import type { ButtonHTMLAttributes, ReactNode } from "react";

export function BusyButton({
  busy,
  children,
  ...props
}: {
  busy: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`primary ${props.className || ""}`}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
