import { useId, useState } from "react";
import { downloadFile } from "@/api/artifacts";
import { endpoints } from "@/api/endpoints";
import type {
  InferenceReportData,
  ReportSource,
} from "@/api/inferenceReportTypes";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Notice } from "@/components/ui/Notice";
import { ReportEvaluation } from "@/features/inference/components/ReportEvaluation";
import { ReportPredictions } from "@/features/inference/components/ReportPredictions";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

const tabs = [
  "Predictions",
  "Evaluation",
  "Error cases",
  "Per-CSV results",
  "Files & run details",
] as const;
export function InferenceReport({
  source,
  go,
  act,
  revision,
}: Pick<HubProps, "act" | "revision" | "go"> & { source: ReportSource }) {
  const report = useRemote<InferenceReportData | null>(
    endpoints.inferenceReport.detail(source),
    null,
    revision,
    30000,
  );
  const [tab, setTab] = useState<(typeof tabs)[number]>("Predictions");
  const tabId = useId();
  const data = report.data;
  if (!data)
    return (
      <>
        <Notice error>{report.error}</Notice>
        {report.loading && <p role="status">Loading saved report…</p>}
      </>
    );
  return (
    <section aria-label="Full inference report">
      <Notice error>{report.error}</Notice>
      <div className="notice" aria-label="Report summary">
        <strong>
          Summary: {data.summary.genuine} genuine, {data.summary.tampered}{" "}
          tampered ({data.summary.total} total)
        </strong>
        <p>
          {data.metrics.num_samples
            ? `Accuracy: ${pct(data.metrics.accuracy)} · Missed tampering: ${data.metrics.fn} · False alarms: ${data.metrics.fp}`
            : "No ground-truth evaluation available."}
        </p>
        {data.summary.failed > 0 && (
          <p>{data.summary.failed} processing failures, included in total.</p>
        )}
      </div>
      {data.provenance?.model && (
        <p className="result-path">
          <strong>Checkpoint:</strong> {data.provenance.model}
        </p>
      )}
      {data.provenance?.config && (
        <p className="result-path">
          <strong>Configuration:</strong> {data.provenance.config}
        </p>
      )}
      {data.provenance?.["thresholds by card_type"] && (
        <p className="result-path">
          <strong>Applied thresholds:</strong>{" "}
          {data.provenance["thresholds by card_type"]}
        </p>
      )}
      <p className="result-path">{data.directory}</p>
      <div className="form-actions">
        <button
          className="primary"
          onClick={() =>
            act(
              () =>
                downloadFile(
                  endpoints.inferenceReport.archive(source),
                  `${data.directory.split("/").pop()}.zip`,
                ),
              "Results downloaded.",
            )
          }
        >
          Download all results (.zip)
        </button>
        <button
          className="secondary"
          onClick={() =>
            act(
              () => navigator.clipboard.writeText(data.directory),
              "Output folder path copied.",
            )
          }
        >
          Copy output folder path
        </button>
      </div>
      {data.warnings.map((warning) => (
        <Notice error key={warning}>
          {warning}
        </Notice>
      ))}
      {!data.full_results && (
        <Notice>
          Predictions are saved. Enable “Save full results” before a new run to
          also export evaluation reports and error images.
        </Notice>
      )}
      <div
        className="report-tabs"
        role="tablist"
        aria-label="Inference report sections"
      >
        {tabs.map((name, index) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`${tabId}-${index}`}
            aria-controls={`${tabId}-panel`}
            tabIndex={tab === name ? 0 : -1}
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                setTab(tabs[next]);
                document.getElementById(`${tabId}-${next}`)?.focus();
              }
            }}
          >
            {name}
            {name === "Error cases"
              ? ` (${data.error_counts.fp + data.error_counts.fn})`
              : ""}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${tabId}-panel`}
        aria-labelledby={`${tabId}-${tabs.indexOf(tab)}`}
      >
        {(tab === "Predictions" || tab === "Error cases") && (
          <ReportPredictions
            key={tab}
            source={source}
            go={go}
            provenance={data.provenance}
            errors={tab === "Error cases"}
          />
        )}
        {tab === "Evaluation" && <ReportEvaluation report={data} />}
        {tab === "Per-CSV results" &&
          (data.per_csv.length ? (
            <Table
              rows={data.per_csv}
              columns={[
                { key: "csv", label: "Input CSV" },
                { key: "num_samples", label: "Evaluated" },
                { key: "fp", label: "FP" },
                { key: "fn", label: "FN" },
                { key: "tp", label: "TP" },
                { key: "tn", label: "TN" },
                ...[
                  ["accuracy", "Accuracy"],
                  ["precision", "Precision"],
                  ["recall", "Recall"],
                  ["f1_score", "F1"],
                  ["auc_roc", "AUC"],
                  ["far", "FAR"],
                  ["frr", "FRR"],
                ].map(([key, label]) => ({
                  key,
                  label,
                  render: (row: Record<string, unknown>) => pct(row[key]),
                })),
              ]}
            />
          ) : (
            <Notice>
              No per-CSV report was saved. It is available for CSV, CSV-folder,
              and batch-YAML inputs when full results are enabled.
            </Notice>
          ))}
        {tab === "Files & run details" && (
          <>
            <Table
              rows={data.files}
              columns={[
                { key: "name", label: "File" },
                { key: "size_bytes", label: "Bytes" },
                {
                  key: "download",
                  label: "Download",
                  render: (row) => (
                    <button
                      className="text-button"
                      onClick={() =>
                        act(
                          () =>
                            downloadFile(
                              endpoints.inferenceReport.file(source, row.name),
                              row.name.split("/").pop(),
                            ),
                          "File downloaded.",
                        )
                      }
                    >
                      Download {row.name}
                    </button>
                  ),
                },
              ]}
            />
            <h3>Run details</h3>
            <pre className="report-run-info">
              {data.run_info || "No run_info.txt was saved for this run."}
            </pre>
          </>
        )}
      </div>
    </section>
  );
}
