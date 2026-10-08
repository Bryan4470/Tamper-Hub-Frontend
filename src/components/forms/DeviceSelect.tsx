import type { Row } from "@/api/types";
import { Field } from "@/components/ui/Field";
import { number } from "@/utils/format";

export function DeviceSelect({
  value,
  onChange,
  gpus,
}: {
  value: string;
  onChange: (s: string) => void;
  gpus: Row[];
}) {
  return (
    <Field label="Compute device">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="cpu">CPU</option>
        {gpus.map((g) => (
          <option key={g.uuid} value={g.uuid}>
            {g.name} · GPU {g.index} ·{" "}
            {number(g.memory_total_mb - g.memory_used_mb)} MB free
          </option>
        ))}
      </select>
    </Field>
  );
}
