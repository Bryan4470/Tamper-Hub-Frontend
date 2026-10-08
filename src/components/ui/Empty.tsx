import type { ReactNode } from "react";

export function Empty({
  title = "Nothing here yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">＋</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
