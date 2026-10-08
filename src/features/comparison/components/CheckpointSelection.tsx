import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import type {
  EpochList,
  EpochRecord,
  SavedCheckpoint,
} from "@/api/studioTypes";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";

export function CheckpointSelection({
  label,
  checkpoints,
  split,
  revision,
  onAdd,
}: {
  label: string;
  checkpoints: SavedCheckpoint[];
  split: "validation" | "test";
  revision: number;
  onAdd: (checkpoint: SavedCheckpoint, result: EpochRecord) => void;
}) {
  const [run, setRun] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const epochs = useRemote<EpochList>(
    run ? endpoints.studio.epochs(run) : null,
    { items: [], warnings: [] },
    revision,
    60000,
  );
  const runs = [
    ...new Map(
      checkpoints.map((item) => [item.run_id, item.run_name]),
    ).entries(),
  ];
  const available = checkpoints.filter((item) => item.run_id === run);
  const selected = available.find((item) => item.id === checkpoint);
  const result =
    selected &&
    epochs.data.items.find(
      (item) =>
        item.split === split &&
        item.checkpoint.replace(/\.(pth|pt)$/, "") ===
          selected.name.replace(/\.(pth|pt)$/, ""),
    );
  const ready =
    result &&
    [
      "accuracy",
      "precision",
      "recall",
      "f1_score",
      "f2_score",
      "auc_roc",
      "far",
      "frr",
    ].some((key) => {
      const value = result.metrics[key];
      return value != null && value !== "" && Number.isFinite(Number(value));
    });
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="form-grid">
        <Field label={`${label} run`}>
          <select
            value={run}
            onChange={(event) => {
              setRun(event.target.value);
              setCheckpoint("");
            }}
          >
            <option value="">Choose run</option>
            {runs.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${label} checkpoint`}>
          <select
            value={checkpoint}
            disabled={!run}
            onChange={(event) => setCheckpoint(event.target.value)}
          >
            <option value="">Choose checkpoint</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Notice error>{epochs.error}</Notice>
      {epochs.data.warnings.map((warning) => (
        <Notice key={warning}>{warning}</Notice>
      ))}
      {selected && !epochs.loading && !ready && (
        <Notice>
          No saved {split} metrics for this checkpoint. Evaluate it first or
          choose another checkpoint.
        </Notice>
      )}
      <button
        type="button"
        className="secondary"
        disabled={!ready || epochs.loading || !!epochs.error}
        onClick={() => {
          if (selected && result) onAdd(selected, result);
        }}
      >
        {label === "Baseline" ? "Set baseline" : "Add candidate"}
      </button>
    </fieldset>
  );
}
