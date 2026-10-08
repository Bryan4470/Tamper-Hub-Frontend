# Shared UI components

## `src/components/ui/Card.tsx`

```tsx
import type { ReactNode } from "react";
export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
```

## `src/components/ui/Field.tsx`

```tsx
import type { ReactNode } from "react";
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
```

## `src/components/ui/Notice.tsx`

```tsx
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
```

## `src/components/ui/BusyButton.tsx`

```tsx
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
```

## `src/components/forms/Picker.tsx`

```tsx
import type { Row } from "@/api/types";
import { number, short } from "@/utils/format";
export function Picker({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: Row[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="picker">
      <legend>
        {label} <span>{selected.length} selected</span>
      </legend>
      {items.length ? (
        <div className="picker-items">
          {items.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              <span>
                {item.name || item.filename || short(item.id)}
                <small>
                  {item.rows !== undefined
                    ? `${number(item.rows)} samples`
                    : short(item.id)}
                </small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">Register an item to select it here.</p>
      )}
    </fieldset>
  );
}
```
