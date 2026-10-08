import type { ReactNode } from "react";

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return children ? (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "danger" : ""}`}
    >
      {children}
    </div>
  ) : null;
}
