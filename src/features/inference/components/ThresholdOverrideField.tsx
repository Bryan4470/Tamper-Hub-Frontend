import { Field } from "@/components/ui/Field";
import { useRemote } from "@/hooks/useRemote";

type InferenceDefaults = { thresholds: Record<string, number> };

export function ThresholdOverrideField({
  defaultsPath,
  card,
  override,
  onChange,
}: {
  defaultsPath: string | null;
  card: string;
  override: string;
  onChange: (value: string) => void;
}) {
  const defaults = useRemote<InferenceDefaults>(
    defaultsPath,
    { thresholds: {} },
    0,
    60000,
  );
  const configured = defaults.data.thresholds?.[card];
  const hint = !defaultsPath
    ? "Choose a checkpoint to see its configured threshold."
    : defaults.error
      ? `Could not read the default: ${defaults.error}`
      : configured === undefined
        ? "Loading the configured threshold…"
        : `Configured default: ${configured}. Editing overrides the threshold for every card type; unchanged uses each card's configured value.`;

  return (
    <div>
      <Field label="Threshold override (optional)" hint={hint}>
        <input
          type="number"
          min={0}
          max={1}
          step="any"
          value={override === "" ? (configured ?? "") : override}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      {override !== "" && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange("")}
        >
          Use configured default
        </button>
      )}
    </div>
  );
}
