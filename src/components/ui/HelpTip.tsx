import { useId, useState } from "react";

export function HelpTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="metric-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="metric-help-button"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        ?
      </button>
      {open && (
        <span id={id} role="tooltip" className="metric-help-text">
          {text}
        </span>
      )}
    </span>
  );
}
