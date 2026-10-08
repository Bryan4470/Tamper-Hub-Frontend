import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { HubProps } from "@/app/types";
import { terminal } from "@/utils/jobs";

export function DeleteJobButton({
  jobId,
  status,
  name,
  busy,
  act,
  onDeleted,
}: Pick<HubProps, "busy" | "act"> & {
  jobId?: string;
  status?: string;
  name: string;
  onDeleted: () => void;
}) {
  return (
    <button
      type="button"
      className="danger-button small"
      aria-label={`Delete run ${name}`}
      disabled={busy || !jobId || !terminal(status || "")}
      title={
        !jobId
          ? "This run has no associated job to delete."
          : !terminal(status || "")
            ? "Cancel the active job and wait for it to stop before deleting."
            : "Delete this run’s job and generated files."
      }
      onClick={(event) => {
        event.stopPropagation();
        if (!jobId || busy || !terminal(status || "")) return;
        if (
          !window.confirm(
            `Delete “${name}” and its generated results, checkpoints, and logs? This cannot be undone. Shared datasets and source images are kept.`,
          )
        )
          return;
        void act(async () => {
          await api(endpoints.jobs.detail(jobId), { method: "DELETE" });
          onDeleted();
        }, "Job and generated files deleted.");
      }}
    >
      Delete
    </button>
  );
}
