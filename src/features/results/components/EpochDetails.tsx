import { MetricLabel } from "@/components/data-display/MetricLabel";
import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import type { EpochList, ResultRow } from "@/api/studioTypes";
import { Table } from "@/components/data-display/Table";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { CardTypeMetrics } from "@/features/results/components/CardTypeMetrics";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

const rates = new Set([
  "accuracy",
  "precision",
  "recall",
  "far",
  "frr",
  "f1_score",
  "f2_score",
  "auc_roc",
  "val_accuracy",
  "val_f1",
  "val_f2",
  "val_auc",
  "val_far",
  "val_frr",
]);
const columns = (rows: ResultRow[]) => {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const preferred = [
    "checkpoint",
    "epoch",
    "rank",
    "csv",
    "card_type",
    "num_samples",
    "frr",
    "far",
    "tp",
    "tn",
    "fp",
    "fn",
  ];
  return [
    ...preferred.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !preferred.includes(key)),
  ].map((key) => ({
    key,
    label: key.replaceAll("_", " "),
    render: (row: ResultRow) =>
      row[key] == null
        ? "N/A"
        : rates.has(key)
          ? pct(row[key])
          : String(row[key]),
  }));
};

export function EpochDetails({
  runId,
  revision,
  initialSplit = "validation",
}: {
  runId: string;
  revision: number;
  initialSplit?: string;
}) {
  const remote = useRemote<EpochList>(
    endpoints.studio.epochs(runId),
    { items: [], warnings: [] },
    revision,
    60000,
  );
  const [split, setSplit] = useState(initialSplit);
  const [checkpoint, setCheckpoint] = useState("");
  const splits = [...new Set(remote.data.items.map((item) => item.split))];
  const activeSplit =
    splits.find((value) => value === split) ||
    splits.find((value) => value === "validation") ||
    splits[0];
  const epochs = remote.data.items.filter((item) => item.split === activeSplit);
  const epoch =
    epochs.find((item) => item.checkpoint === checkpoint) || epochs[0];
  const historyKeys = [
    "epoch",
    "val_accuracy",
    "val_f1",
    "val_f2",
    "val_auc",
    "val_far",
    "val_frr",
    "val_loss",
  ];
  const history = (epoch?.history || []).map((row) =>
    Object.fromEntries(
      historyKeys.filter((key) => key in row).map((key) => [key, row[key]]),
    ),
  );
  const constraint = epoch?.metrics.far_constraint_met;
  const constraintMet =
    constraint === true ||
    constraint === 1 ||
    String(constraint).toLowerCase() === "true";
  return (
    <section className="epoch-details">
      <h3>Epoch details</h3>
      <Notice error>{remote.error}</Notice>
      {remote.data.warnings.map((warning) => (
        <Notice error key={warning}>
          {warning}
        </Notice>
      ))}
      {remote.loading ? (
        <p role="status">Reading saved epochs…</p>
      ) : epoch ? (
        <>
          <div className="results-filters">
            <Field label="Evaluation split">
              <select
                value={activeSplit}
                onChange={(event) => setSplit(event.target.value)}
              >
                {splits.map((value) => (
                  <option key={value} value={value}>
                    {value === "validation" ? "Validation" : "Test"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Epoch checkpoint">
              <select
                value={epoch.checkpoint}
                onChange={(event) => setCheckpoint(event.target.value)}
              >
                {epochs.map((item) => (
                  <option key={item.checkpoint} value={item.checkpoint}>
                    {item.checkpoint}
                    {item.epoch == null ? "" : ` · epoch ${item.epoch}`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="muted">
            {activeSplit === "validation"
              ? "Use validation results for checkpoint selection."
              : "Test results are for final evaluation."}{" "}
            Source: {epoch.metric_source || "No saved aggregate metrics"}.
          </p>
          <div className="epoch-metric-grid">
            {[
              ["far", "FAR"],
              ["recall", "Tamper recall"],
              ["frr", "FRR"],
              ["f2_score", "F2"],
              ["f1_score", "F1"],
              ["auc_roc", "AUC"],
            ].map(([key, label]) => (
              <div className="metric" key={key}>
                <MetricLabel metric={key} label={label} />
                <strong>{pct(epoch.metrics[key])}</strong>
              </div>
            ))}
          </div>
          {["tp", "tn", "fp", "fn"].some(
            (key) => epoch.metrics[key] != null,
          ) && (
            <div className="epoch-count-grid">
              {[
                ["tp", "True tamper"],
                ["tn", "True genuine"],
                ["fp", "False reject"],
                ["fn", "Missed tamper"],
              ].map(([key, label]) => (
                <div className="metric" key={key}>
                  <MetricLabel metric={key} label={label} />
                  <strong>
                    {epoch.metrics[key] == null
                      ? "N/A"
                      : Number(epoch.metrics[key]).toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {constraint != null && (
            <p className="muted">
              Production FAR constraint: {constraintMet ? "met" : "not met"}
            </p>
          )}
          <CardTypeMetrics
            key={`${activeSplit}:${epoch.checkpoint}`}
            runId={runId}
            predictions={epoch.predictions}
            revision={revision}
          />
          <h4>Validation record for this epoch</h4>
          {history.length ? (
            <Table rows={history} columns={columns(history)} />
          ) : (
            <Empty title="No validation record for this epoch" />
          )}
          {activeSplit === "test" ? (
            <>
              <h4>Test datasets for this epoch</h4>
              {epoch.datasets.length ? (
                <Table
                  rows={epoch.datasets}
                  columns={columns(epoch.datasets)}
                />
              ) : (
                <Empty title="Per-dataset results are unavailable for this epoch" />
              )}
            </>
          ) : (
            <p className="muted">
              Choose Test to inspect results for individual evaluation datasets.
            </p>
          )}
        </>
      ) : (
        !remote.error && (
          <Empty title="No saved epoch results">
            Epoch details appear when checkpoint summaries or training history
            are available.
          </Empty>
        )
      )}
    </section>
  );
}
