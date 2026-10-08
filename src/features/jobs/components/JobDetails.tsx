import { api, submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps, PageName } from "@/app/types";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useJobLogs } from "@/hooks/useJobLogs";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";
import { terminal } from "@/utils/jobs";

export function JobDetails(
  props: Pick<HubProps, "revision" | "busy" | "act" | "go"> & {
    selected: string;
    onDeleted: () => void;
  },
) {
  const { selected } = props;
  const { logs, logError } = useJobLogs(selected);
  const details = useRemote<Row>(
    selected ? endpoints.jobs.detail(selected) : null,
    {},
    props.revision,
    2000,
  );

  const resultPage: Record<string, PageName> = {
    training: "training",
    inference: "inference",
    evaluation: "evaluation",
    comparison: "comparison",
    sweep: "evaluation",
  };

  return (
    <Card
      title={details.data.name || `${details.data.kind || ""} job`}
      subtitle={`${details.data.kind || "Job"} · ${selected}`}
      action={
        <div className="button-group">
          {resultPage[details.data.kind] && (
            <button
              className="secondary"
              onClick={() =>
                props.go(
                  resultPage[details.data.kind],
                  details.data.resource_id,
                )
              }
            >
              Open results
            </button>
          )}
          <button
            className="danger-button"
            disabled={
              props.busy ||
              !details.data.status ||
              terminal(details.data.status)
            }
            onClick={() =>
              props.act(
                () => submit(endpoints.jobs.cancel(selected), {}, false),
                "Cancellation requested.",
              )
            }
          >
            Cancel job
          </button>
          <button
            className="danger-button"
            disabled={props.busy || !terminal(details.data.status)}
            title="Delete a finished job and its generated files."
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this job and its generated results, checkpoints, and logs? This cannot be undone. Shared datasets and source images are kept.",
                )
              )
                return;
              void props.act(async () => {
                await api(endpoints.jobs.detail(selected), {
                  method: "DELETE",
                });
                props.onDeleted();
              }, "Job and generated files deleted.");
            }}
          >
            Delete job
          </button>
        </div>
      }
    >
      <div className="detail-summary">
        <Status value={details.data.status} />
        <span>{details.data.phase}</span>
        <span>{pct(details.data.progress)}</span>
      </div>
      <p className="muted">
        Delete permanently removes this job’s results, checkpoints, and logs.
        Shared datasets and source images are kept. Cancel active jobs first.
      </p>
      <Notice error>{details.data.error || details.error || logError}</Notice>
      <progress
        className="wide-progress"
        max="1"
        value={details.data.progress || 0}
      />
      <h3 className="section-label">Execution log</h3>
      <pre className="log-view" aria-label="Execution log">
        {logs ||
          (details.data.status === "queued"
            ? "Waiting for a worker. Start a worker for the selected device if none is online."
            : "No log output yet.")}
      </pre>
    </Card>
  );
}
