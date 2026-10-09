import type { Row } from "@/api/types";
import { Field } from "@/components/ui/Field";
import {
  evaluationSettings,
  thresholdPrefix,
  farKey,
} from "@/features/training/utils/evaluationSettings";

export function TrainingEvaluationSettings({
  template,
  overrides,
  onChange,
  onReset,
}: {
  template: Row;
  overrides: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
}) {
  const values = evaluationSettings(template, overrides);
  return (
    <details className="inner-details settings-group">
      <summary>Evaluation settings</summary>
      <p>
        Controls validation/test classification and checkpoint selection; does
        not change the training loss. Tune thresholds using validation data and
        reserve test data for final evaluation.
      </p>
      <div className="settings-grid">
        {values.thresholds.map(({ card, value }) => (
          <Field
            key={card}
            label={`${card} tamper threshold`}
            hint="Classify as tampered when its tamper probability meets or exceeds this value."
          >
            <input
              type="number"
              min="0"
              max="1"
              step="any"
              required
              value={Number.isFinite(value) ? value : ""}
              onChange={(event) =>
                onChange(
                  `${thresholdPrefix}.${card}`,
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
            />
          </Field>
        ))}
        <Field
          label="FAR constraint (%)"
          hint="Maximum FAR for the best-checkpoint selection under the FAR constraint. 0.2% is saved as 0.002."
        >
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            required
            value={
              Number.isFinite(values.far)
                ? Number((values.far * 100).toPrecision(12))
                : ""
            }
            onChange={(event) =>
              onChange(
                farKey,
                event.target.value === ""
                  ? ""
                  : Number(event.target.value) / 100,
              )
            }
          />
        </Field>
      </div>
      <button type="button" className="secondary" onClick={onReset}>
        Reset evaluation to config defaults
      </button>
    </details>
  );
}
