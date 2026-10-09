import { csvDisplayName } from "@/utils/csvDisplayName";
import { useState } from "react";
import { downloadFile } from "@/api/artifacts";
import { endpoints } from "@/api/endpoints";
import type {
  SavedCheckpointList,
  ResultRow,
  SavedArtifact,
  SavedTable,
} from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { Metrics } from "@/components/data-display/Metrics";
import { Table } from "@/components/data-display/Table";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

const emptyTable: SavedTable = {
  items: [],
  columns: [],
  total: 0,
  unfiltered: 0,
  offset: 0,
  limit: 50,
};
const rate =
  /^(accuracy|precision|recall|f1_score|f2_score|auc_roc|far|frr|prob_genuine|prob_tampered|threshold|val_accuracy|val_f1|val_f2|val_auc|val_far|val_frr)$/;

export function SavedArtifactTable({
  runId,
  go,
  artifact,
  revision,
  act,
  onOpenCheckpoint,
}: Pick<HubProps, "revision" | "act" | "go"> & {
  runId: string;
  artifact: SavedArtifact;
  onOpenCheckpoint: (checkpoint: string) => void;
}) {
  const catalog = useRemote<SavedCheckpointList>(
    artifact.kind === "predictions" ? endpoints.studio.checkpoints : null,
    { items: [] },
    revision,
    60000,
  );
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [card, setCard] = useState("");
  const [selected, setSelected] = useState<ResultRow | null>(null);
  const table = useRemote<SavedTable>(
    endpoints.studio.table(runId, artifact.id, offset, query, outcome, card),
    emptyTable,
    revision,
    60000,
  );
  const reset = () => {
    setOffset(0);
    setSelected(null);
  };
  const metrics =
    selected && table.data.items.includes(selected)
      ? selected
      : table.data.items[0];
  const preferred =
    artifact.kind === "predictions"
      ? [
          "image_path",
          "sample_id",
          "ground_truth",
          "prediction",
          "prob_tampered",
          "threshold",
          "outcome",
          "card_type",
        ]
      : [
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
          "f2_score",
          "f1_score",
          "auc_roc",
        ];
  const columns = [
    ...preferred.filter((key) => table.data.columns.includes(key)),
    ...table.data.columns.filter((key) => !preferred.includes(key)),
  ];
  return (
    <div className="saved-artifact">
      <div className="form-actions">
        <span className="muted result-path">{artifact.filename}</span>
        {!artifact.derived && (
          <button
            className="secondary"
            onClick={() =>
              act(
                () =>
                  downloadFile(
                    endpoints.studio.download(runId, artifact.id),
                    artifact.filename.split("/").pop() || "results.csv",
                  ),
                "Saved artifact downloaded.",
              )
            }
          >
            Download saved file
          </button>
        )}
      </div>
      {artifact.derived && (
        <Notice>
          {artifact.split === "validation"
            ? "Validation metrics are read from training history because this run has no saved validation checkpoint summary."
            : "Checkpoint metrics are read from the original evaluation text reports."}
        </Notice>
      )}
      <form
        className="results-filters"
        onSubmit={(e) => {
          e.preventDefault();
          reset();
          setQuery(search);
        }}
      >
        <Field label="Search result rows">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Image, checkpoint, dataset, or metadata"
          />
        </Field>
        {artifact.kind === "predictions" && (
          <>
            <Field label="Prediction outcome">
              <select
                value={outcome}
                onChange={(e) => {
                  reset();
                  setOutcome(e.target.value);
                }}
              >
                <option value="">All outcomes</option>
                {[
                  "Correct",
                  "False acceptance",
                  "False rejection",
                  "Failed",
                  "Unlabeled",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Prediction card type">
              <select
                value={card}
                onChange={(e) => {
                  reset();
                  setCard(e.target.value);
                }}
              >
                <option value="">All card types</option>
                <option value="mykadfront">MyKad front</option>
                <option value="mykadback">MyKad back</option>
              </select>
            </Field>
          </>
        )}
        <button type="submit" className="secondary">
          Search rows
        </button>
      </form>
      <Notice error>{table.error}</Notice>
      {table.loading ? (
        <p role="status">Reading saved rows…</p>
      ) : (
        <>
          {metrics &&
            artifact.kind === "metrics" &&
            table.data.columns.includes("far") && (
              <>
                <p className="muted">
                  Metrics for{" "}
                  {String(
                    metrics.checkpoint ||
                      metrics.csv ||
                      "the first displayed row",
                  )}
                  . Click a checkpoint to inspect its metrics, or an epoch to
                  open Epoch details.
                </p>
                <Metrics values={metrics} />
              </>
            )}
          {table.data.items.length ? (
            <Table
              rows={table.data.items}
              columns={[
                ...(artifact.kind === "predictions"
                  ? [
                      {
                        key: "gradcam",
                        label: "Explain",
                        render: (row: ResultRow) => (
                          <button
                            className="text-button"
                            onClick={() =>
                              go(
                                "gradcam",
                                JSON.stringify({
                                  image_path: row.image_path,
                                  card_type: row.card_type,
                                  run_id: runId,
                                  checkpoint_path: catalog.data.items.find(
                                    (c) =>
                                      c.run_id === runId &&
                                      c.name.replace(/\.(pth|pt)$/, "") ===
                                        String(
                                          row.checkpoint ||
                                            artifact.filename
                                              .split("/")
                                              .pop()
                                              ?.replace(/\.csv(\.gz)?$/, ""),
                                        ).replace(/\.(pth|pt)$/, ""),
                                  )?.checkpoint_path,
                                }),
                              )
                            }
                          >
                            View Grad-CAM
                          </button>
                        ),
                      },
                    ]
                  : []),
                ...columns.map((key) => ({
                  key,
                  label: key.replaceAll("_", " "),
                  render: (row: ResultRow) => {
                    const checkpoint =
                      row.checkpoint != null && row.checkpoint !== ""
                        ? String(row.checkpoint).replace(/\.(pth|pt)$/, "")
                        : row.epoch != null && row.epoch !== ""
                          ? `epoch_${row.epoch}`
                          : "";
                    if (
                      artifact.kind !== "predictions" &&
                      key === "epoch" &&
                      row[key] != null &&
                      row[key] !== "" &&
                      checkpoint
                    ) {
                      return (
                        <button
                          type="button"
                          className="text-button"
                          title={`Open ${checkpoint} in Epoch details`}
                          onClick={() => onOpenCheckpoint(checkpoint)}
                        >
                          {String(row[key])}
                        </button>
                      );
                    }
                    const cell = (
                      <span
                        className={
                          key === "csv" ||
                          key === "source_csv" ||
                          key === "metadata_source_csv"
                            ? "csv-display-name"
                            : "result-cell"
                        }
                        title={String(row[key] ?? "N/A")}
                      >
                        {row[key] == null || row[key] === ""
                          ? "N/A"
                          : key === "csv" ||
                              key === "source_csv" ||
                              key === "metadata_source_csv"
                            ? csvDisplayName(row[key])
                            : rate.test(key)
                              ? pct(row[key])
                              : String(row[key])}
                      </span>
                    );
                    return artifact.kind === "metrics" && key === columns[0] ? (
                      <button
                        className="text-button"
                        onClick={() => setSelected(row)}
                      >
                        {cell}
                      </button>
                    ) : (
                      cell
                    );
                  },
                })),
              ]}
            />
          ) : (
            !table.error && (
              <Empty title="No saved rows match">
                Try another artifact or clear the filters.
              </Empty>
            )
          )}
        </>
      )}
      <div className="pagination">
        <span>
          {table.data.total.toLocaleString()} matching /{" "}
          {table.data.unfiltered.toLocaleString()} total rows · page{" "}
          {Math.floor(offset / 50) + 1}
        </span>
        <button
          disabled={offset === 0 || table.loading}
          onClick={() => {
            setSelected(null);
            setOffset(Math.max(0, offset - 50));
          }}
        >
          Previous rows
        </button>
        <button
          disabled={offset + 50 >= table.data.total || table.loading}
          onClick={() => {
            setSelected(null);
            setOffset(offset + 50);
          }}
        >
          Next rows
        </button>
      </div>
      {artifact.kind === "predictions" && (
        <p className="muted">
          False acceptance: tampered predicted genuine. False rejection: genuine
          predicted tampered. Missing labels remain unlabeled. Legacy confidence
          values are displayed as saved; use prob tampered for the tamper
          probability.
        </p>
      )}
    </div>
  );
}
