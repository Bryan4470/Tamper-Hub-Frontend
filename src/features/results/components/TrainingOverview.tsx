import { endpoints } from "@/api/endpoints";
import type { ResultRow } from "@/api/studioTypes";
import { Chart } from "@/components/data-display/Chart";
import { Table } from "@/components/data-display/Table";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";

type Overview = {
  facts: { label: string; value: string | number | boolean | null }[];
  timestamps: Record<string, string | null>;
  elapsed_seconds: number | null;
  timing: {
    totals?: Record<string, number | null>;
    epochs?: ResultRow[];
    test_evaluations?: ResultRow[];
  };
  split_counts: Record<string, number>;
  sources: string[];
  warnings: string[];
};
function duration(value: unknown) {
  if (value == null || !Number.isFinite(Number(value))) return "Not recorded";
  const seconds = Math.max(0, Math.round(Number(value)));
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
export function TrainingOverview({
  directory,
  history,
  revision,
}: {
  directory: string;
  history: ResultRow[];
  revision: number;
}) {
  const remote = useRemote<Overview | null>(
    endpoints.training.overview(directory),
    null,
    revision,
    30000,
  );
  const data = remote.data;
  return (
    <section aria-label="Training overview">
      <h3>Training overview</h3>
      <Notice error>{remote.error}</Notice>
      {remote.loading && !data && (
        <p role="status">Reading training overview…</p>
      )}
      {data && (
        <>
          {data.warnings.map((warning) => (
            <Notice key={warning}>{warning}</Notice>
          ))}
          <div className="metric-grid">
            {[
              "Completed epochs",
              "Configured epochs",
              "Backbone",
              "Image size",
              "Batch size",
            ].map((label) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <strong>
                  {String(
                    data.facts.find((f) => f.label === label)?.value ??
                      "Not recorded",
                  )}
                </strong>
              </div>
            ))}
          </div>
          <h3>Run timing</h3>
          <div className="metric-grid">
            {[
              ["overall_seconds", "Recorded stage total"],
              ["train_seconds", "Training time"],
              ["val_seconds", "Validation time"],
              ["test_seconds", "Test evaluation time"],
            ].map(([key, label]) => (
              <div className="metric" key={key}>
                <span>{label}</span>
                <strong>{duration(data.timing.totals?.[key])}</strong>
              </div>
            ))}
          </div>
          <p className="muted">
            Recorded stage total sums training, validation, and test evaluation
            time. It is not elapsed wall time and may exclude setup, saving, and
            other overhead.
          </p>
          <dl className="prediction-metrics">
            {Object.entries(data.timestamps).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {key.replace("_at", "").replace(/^./, (s) => s.toUpperCase())}
                </dt>
                <dd>{value || "Not recorded"}</dd>
              </div>
            ))}
            <div>
              <dt>Elapsed wall time (start to finish)</dt>
              <dd>{duration(data.elapsed_seconds)}</dd>
            </div>
          </dl>
          <h3>Saved dataset splits</h3>
          {Object.keys(data.split_counts).length ? (
            <div className="metric-grid">
              {Object.entries(data.split_counts).map(([key, value]) => (
                <div className="metric" key={key}>
                  <span>
                    {key === "val"
                      ? "Validation"
                      : key === "train"
                        ? "Training"
                        : "Test"}{" "}
                    rows
                  </span>
                  <strong>{value.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>Saved split manifests are unavailable.</p>
          )}
          <h3>Training configuration</h3>
          <Table
            rows={data.facts}
            columns={[
              { key: "label", label: "Setting" },
              {
                key: "value",
                label: "Saved value",
                render: (row) =>
                  row.value == null ? "Not recorded" : String(row.value),
              },
            ]}
          />
          {!!data.timing.epochs?.length && (
            <details className="inner-details">
              <summary>
                Per-epoch timing ({data.timing.epochs.length} epochs)
              </summary>
              <Table
                rows={data.timing.epochs}
                columns={[
                  { key: "epoch", label: "Epoch" },
                  ...[
                    ["train_seconds", "Training"],
                    ["val_seconds", "Validation"],
                    ["total_seconds", "Recorded total"],
                  ].map(([key, label]) => ({
                    key,
                    label,
                    render: (row: ResultRow) => duration(row[key]),
                  })),
                ]}
              />
            </details>
          )}
          {!!data.timing.test_evaluations?.length && (
            <details className="inner-details">
              <summary>Test evaluation timing</summary>
              <Table
                rows={data.timing.test_evaluations}
                columns={[
                  { key: "checkpoint", label: "Checkpoint" },
                  {
                    key: "seconds",
                    label: "Duration",
                    render: (row) => duration(row.seconds),
                  },
                ]}
              />
            </details>
          )}
          {!!history.length && (
            <Chart
              title="Training and validation loss"
              rows={history}
              xKey="epoch"
              lines={[
                { key: "train_loss", label: "Training", color: "#23836c" },
                { key: "val_loss", label: "Validation", color: "#d78342" },
              ]}
            />
          )}
          <p className="muted">
            Sources: {data.sources.join(" · ")}. Missing values are shown as not
            recorded; file modification times are not used as training
            timestamps.
          </p>
        </>
      )}
    </section>
  );
}
