import { useState } from "react";
import type { Row } from "@/api/types";
import { endpoints } from "@/api/endpoints";
import type {
  EpochRecord,
  SavedCheckpoint,
  SavedCheckpointList,
} from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { CheckpointSelection } from "@/features/comparison/components/CheckpointSelection";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

type Selection = { checkpoint: SavedCheckpoint; result: EpochRecord };
const metrics = [
  ["accuracy", "Accuracy"],
  ["precision", "Precision"],
  ["recall", "Recall"],
  ["f1_score", "F1"],
  ["f2_score", "F2"],
  ["auc_roc", "ROC AUC"],
  ["far", "FAR ↓"],
  ["frr", "FRR ↓"],
];
function numeric(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function CheckpointComparison(props: Pick<HubProps, "revision">) {
  const checkpoints = useRemote<SavedCheckpointList>(
    endpoints.studio.checkpoints,
    { items: [] },
    props.revision,
    60000,
  );
  const [split, setSplit] = useState<"validation" | "test">("validation");
  const [baseline, setBaseline] = useState<Selection | null>(null);
  const [candidates, setCandidates] = useState<Selection[]>([]);
  const selections = baseline ? [baseline, ...candidates] : [];
  const rows = selections.map((selection, index) => ({
    id: selection.checkpoint.id,
    name: selection.checkpoint.run_name,
    checkpoint: selection.checkpoint.name,
    role: index === 0 ? "Baseline" : "Candidate",
    metrics: selection.result.metrics,
    source: selection.result.metric_source,
  }));
  return (
    <Card
      title="Compare runs and checkpoints"
      subtitle="Compare saved results directly from training runs, including legacy runs."
    >
      <Notice error>{checkpoints.error}</Notice>
      <Field label="Comparison split">
        <select
          value={split}
          onChange={(event) => {
            setSplit(event.target.value as "validation" | "test");
            setBaseline(null);
            setCandidates([]);
          }}
        >
          <option value="validation">Validation</option>
          <option value="test">Test</option>
        </select>
      </Field>
      <p className="muted">
        Use validation for checkpoint selection; use test results for final
        assessment. Changing the split clears the comparison.
      </p>
      {!checkpoints.loading && !checkpoints.data.items.length && (
        <Empty title="No saved checkpoints found">
          Training runs need a config and checkpoint files to appear here.
        </Empty>
      )}
      <div className="form-grid">
        <CheckpointSelection
          key={`baseline-${split}`}
          label="Baseline"
          checkpoints={checkpoints.data.items}
          split={split}
          revision={props.revision}
          onAdd={(checkpoint, result) => {
            setBaseline({ checkpoint, result });
            setCandidates((items) =>
              items.filter((item) => item.checkpoint.id !== checkpoint.id),
            );
          }}
        />
        <CheckpointSelection
          key={`candidate-${split}`}
          label="Candidate"
          checkpoints={checkpoints.data.items.filter(
            (item) => item.id !== baseline?.checkpoint.id,
          )}
          split={split}
          revision={props.revision}
          onAdd={(checkpoint, result) =>
            setCandidates((items) => [
              ...items.filter((item) => item.checkpoint.id !== checkpoint.id),
              { checkpoint, result },
            ])
          }
        />
      </div>
      {baseline && (
        <>
          <h3>Saved {split} comparison</h3>
          <Notice>
            These are saved metrics, not a new evaluation. Dataset membership
            and thresholds have not been verified as identical across runs. Use
            evaluation comparison below for compatibility checks.
          </Notice>
          {!candidates.length && (
            <p>Add a candidate checkpoint to compare with the baseline.</p>
          )}
          <Table
            rows={rows}
            columns={[
              {
                key: "name",
                label: "Run / checkpoint",
                render: (row) => (
                  <>
                    <strong>{row.name}</strong>
                    <small className="subcell">
                      {row.checkpoint} · {row.role}
                    </small>
                    <small className="subcell">{row.source}</small>
                  </>
                ),
              },
              ...metrics.map(([key, label]) => ({
                key,
                label,
                render: (row: Row) => {
                  const value = numeric(row.metrics[key]);
                  const reference = numeric(baseline.result.metrics[key]);
                  const delta =
                    value !== null && reference !== null
                      ? (value - reference) * 100
                      : null;
                  return (
                    <>
                      {value === null ? "—" : pct(value)}
                      {row.role !== "Baseline" && delta !== null && (
                        <small className="subcell">
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(2)} pp
                        </small>
                      )}
                    </>
                  );
                },
              })),
              {
                key: "samples",
                label: "Samples",
                render: (row) => {
                  const values = ["tp", "tn", "fp", "fn"].map((key) =>
                    numeric(row.metrics[key]),
                  );
                  return values.every((value) => value !== null)
                    ? values
                        .reduce<number>(
                          (total, value) => total + (value ?? 0),
                          0,
                        )
                        .toLocaleString()
                    : "—";
                },
              },
              {
                key: "remove",
                label: "",
                render: (row) =>
                  row.role === "Candidate" && (
                    <button
                      className="text-button"
                      onClick={() =>
                        setCandidates((items) =>
                          items.filter((item) => item.checkpoint.id !== row.id),
                        )
                      }
                    >
                      Remove {row.checkpoint}
                    </button>
                  ),
              },
            ]}
          />
          <p className="muted">
            Changes are percentage points relative to the baseline. Lower FAR
            and FRR are better; higher values are better for the other metrics.
            Missing metrics are shown as —.
          </p>
        </>
      )}
    </Card>
  );
}
