import { EpochImageViewer } from "@/features/results/components/EpochImageViewer";
import { csvDisplayName } from "@/utils/csvDisplayName";
import { useState, useRef } from "react";
import type {
  CardPerformance,
  EpochRecord,
  ResultRow,
} from "@/api/studioTypes";
import { endpoints } from "@/api/endpoints";
import { Table } from "@/components/data-display/Table";
import { Field } from "@/components/ui/Field";
import { Empty } from "@/components/ui/Empty";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

const metricGroups = {
  Summary: [
    "csv",
    "num_samples",
    "far",
    "frr",
    "f1_score",
    "auc_roc",
    "threshold",
  ],
  Counts: [
    "csv",
    "num_samples",
    "num_genuine",
    "num_tamper",
    "evaluated",
    "excluded",
  ],
  "Confusion matrix": ["csv", "tp", "tn", "fp", "fn"],
  "Other rates": ["csv", "accuracy", "precision", "recall", "f2_score"],
};
const rates = new Set([
  "accuracy",
  "precision",
  "recall",
  "far",
  "frr",
  "f1_score",
  "f2_score",
  "auc_roc",
]);

export function EpochCsvResults({
  runId,
  epoch,
  revision,
}: {
  revision: number;
  runId: string;
  epoch: EpochRecord;
}) {
  const [metricGroup, setMetricGroup] =
    useState<keyof typeof metricGroups>("Summary");
  const [viewer, setViewer] = useState<{
    csv: string;
    cell: string;
    version: number;
  } | null>(null);
  const viewerAnchor = useRef<HTMLDivElement>(null);
  function openImages(csv: string, cell = "") {
    setViewer((current) => ({
      csv,
      cell,
      version: (current?.version || 0) + 1,
    }));
    requestAnimationFrame(() =>
      viewerAnchor.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }
  const [selected, setSelected] = useState("");
  const prediction =
    epoch.predictions.find((item) => item.id === selected) ||
    epoch.predictions[0];
  const remote = useRemote<CardPerformance | null>(
    prediction ? endpoints.studio.performance(runId, prediction.id) : null,
    null,
    revision,
    60000,
  );
  const rows = remote.data?.datasets || epoch.datasets;
  const cardOrder = [
    "mykadfront",
    "mykadback",
    "mykadfront_2026",
    "mykadback_2026",
  ];
  const groupedRows = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const folderCard = String(row.csv || row.source_csv || "")
      .replaceAll("\\", "/")
      .split("/")
      .find((part) => cardOrder.includes(part));
    const card = folderCard || String(row.card_type || "Other card types");
    groupedRows.set(card, [...(groupedRows.get(card) || []), row]);
  }
  const groups = [...groupedRows].sort(([a], [b]) => {
    const rank = (card: string) =>
      cardOrder.includes(card) ? cardOrder.indexOf(card) : cardOrder.length;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return (
    <section aria-label="Per-CSV metrics and predictions">
      <h4>Per-CSV metrics for this epoch</h4>
      <p className="muted">
        {epoch.checkpoint} · {epoch.split}. Metrics use saved predictions and
        their recorded thresholds. Missing or undefined metrics appear as N/A.
      </p>
      {epoch.predictions.length > 1 && (
        <Field label="Per-CSV prediction file">
          <select
            value={prediction.id}
            onChange={(event) => {
              setSelected(event.target.value);
              setViewer(null);
            }}
          >
            {epoch.predictions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Notice error>{remote.error}</Notice>
      {remote.data?.warnings.map((warning) => (
        <Notice key={warning}>{warning}</Notice>
      ))}
      {remote.loading ? (
        <p role="status">Reading per-CSV metrics…</p>
      ) : rows.length ? (
        <>
          {!remote.data?.datasets && (
            <p className="muted">Showing saved per-CSV summary metrics.</p>
          )}
          <Field label="Per-CSV metrics displayed">
            <select
              value={metricGroup}
              onChange={(event) =>
                setMetricGroup(event.target.value as keyof typeof metricGroups)
              }
            >
              {Object.keys(metricGroups).map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </Field>
          {groups.map(([card, csvRows]) => (
            <section
              className="epoch-csv-card-group"
              key={card}
              aria-label={`${card} CSV metrics`}
            >
              <h5>
                {card}{" "}
                <span>
                  {csvRows.length} CSV{csvRows.length === 1 ? "" : "s"}
                </span>
              </h5>
              <div className="epoch-csv-metrics-table">
                <Table
                  rows={csvRows}
                  columns={metricGroups[metricGroup]
                    .filter((key) => rows.some((row) => key in row))
                    .map((key) => ({
                      key,
                      label: key.replaceAll("_", " "),
                      render: (row) =>
                        row[key] == null ? (
                          "N/A"
                        ) : key === "csv" ? (
                          <button
                            type="button"
                            className="text-button csv-display-name"
                            disabled={!prediction || !remote.data?.datasets}
                            title={String(row[key])}
                            onClick={() => openImages(String(row.csv))}
                          >
                            {csvDisplayName(row[key])}
                          </button>
                        ) : ["tp", "tn", "fp", "fn"].includes(key) &&
                          prediction &&
                          remote.data?.datasets ? (
                          <button
                            type="button"
                            className="text-button"
                            aria-label={`View ${key.toUpperCase()} images for ${csvDisplayName(row.csv)}`}
                            onClick={() => openImages(String(row.csv), key)}
                          >
                            {String(row[key])}
                          </button>
                        ) : rates.has(key) ? (
                          pct(row[key])
                        ) : (
                          String(row[key])
                        ),
                    }))}
                />
              </div>
            </section>
          ))}
        </>
      ) : (
        <Empty title="No per-CSV metrics saved for this epoch" />
      )}
      <div ref={viewerAnchor}>
        {viewer && prediction && (
          <EpochImageViewer
            key={`${prediction.id}:${viewer.csv}:${viewer.cell}:${viewer.version}`}
            runId={runId}
            artifactId={prediction.id}
            csv={viewer.csv}
            initialCell={viewer.cell}
            revision={revision}
            onClose={() => setViewer(null)}
          />
        )}
      </div>
    </section>
  );
}
