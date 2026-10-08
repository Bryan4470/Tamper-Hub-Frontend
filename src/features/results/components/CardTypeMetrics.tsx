import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import type { CardPerformance, SavedArtifact } from "@/api/studioTypes";
import { Table } from "@/components/data-display/Table";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

const keys = [
  "card_type",
  "num_samples",
  "frr",
  "far",
  "tp",
  "tn",
  "fp",
  "fn",
  "accuracy",
  "precision",
  "recall",
  "f1_score",
  "f2_score",
  "auc_roc",
  "evaluated",
  "excluded",
  "threshold",
];
const rates = new Set([
  "frr",
  "far",
  "accuracy",
  "precision",
  "recall",
  "f1_score",
  "f2_score",
  "auc_roc",
]);

export function CardTypeMetrics({
  runId,
  predictions,
  revision,
}: {
  runId: string;
  predictions: SavedArtifact[];
  revision: number;
}) {
  const [selected, setSelected] = useState("");
  const prediction =
    predictions.find((item) => item.id === selected) || predictions[0];
  const remote = useRemote<CardPerformance | null>(
    prediction ? endpoints.studio.performance(runId, prediction.id) : null,
    null,
    revision,
    60000,
  );
  return (
    <section>
      <h4>Performance by card type</h4>
      {predictions.length > 1 && (
        <Field label="Card metrics prediction file">
          <select
            value={prediction.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {predictions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Notice error>{remote.error}</Notice>
      {!prediction ? (
        <Empty title="No saved predictions for card-type metrics">
          This checkpoint and split need saved per-image predictions to
          calculate the breakdown.
        </Empty>
      ) : remote.loading ? (
        <p role="status">Calculating card-type metrics…</p>
      ) : (
        remote.data && (
          <>
            {remote.data.warnings.map((warning) => (
              <Notice error key={warning}>
                {warning}
              </Notice>
            ))}
            <p className="muted">
              Calculated from saved predictions using their applied decisions.
              Tamper is the positive class. Failed or unlabeled rows are
              excluded; unavailable rates are N/A.
            </p>
            {remote.data.cards.length ? (
              <Table
                rows={remote.data.cards}
                columns={keys.map((key) => ({
                  key,
                  label: key.replaceAll("_", " "),
                  render: (row) =>
                    row[key] == null
                      ? "N/A"
                      : rates.has(key)
                        ? pct(row[key])
                        : String(row[key]),
                }))}
              />
            ) : (
              <Empty title="No card-type results available" />
            )}
            <details className="inner-details">
              <summary>Prediction source</summary>
              <p className="result-path">{prediction.filename}</p>
            </details>
          </>
        )
      )}
    </section>
  );
}
