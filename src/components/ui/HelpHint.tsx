import { useId } from "react";
import type { ReactNode } from "react";

export function HelpHint({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <div className="help-hint">
      <button
        type="button"
        className="help-hint-trigger"
        aria-label={`Help: ${title}`}
        popoverTarget={id}
      >
        ?
      </button>
      <div
        id={id}
        popover="auto"
        className="help-hint-content"
        role="region"
        aria-labelledby={`${id}-title`}
      >
        <div className="help-hint-heading">
          <h3 id={`${id}-title`}>{title}</h3>
          <button
            type="button"
            className="secondary small"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={`Close help: ${title}`}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
