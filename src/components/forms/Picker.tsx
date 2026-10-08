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
