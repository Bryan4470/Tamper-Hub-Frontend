import { useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page, type Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";

export function ModelJobs({
  modelId,
  modelName,
  revision,
  busy,
  act,
  go,
}: {
  modelId: string;
  modelName: string;
} & Pick<HubProps, "revision" | "busy" | "act" | "go">) {
  const [adding, setAdding] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedJob, setSelectedJob] = useState("");
  const linked = useRemote<{ items: Row[] }>(
    endpoints.models.jobs(modelId),
    { items: [] },
    revision,
    30000,
  );
  const jobs = useRemote<Page>(
    adding ? `${endpoints.jobs.list("", 100)}&offset=${offset}` : null,
    emptyPage,
    revision,
    30000,
  );
  const linkedIds = new Set(linked.data.items.map((job) => job.id));
  const candidates = jobs.data.items.filter((job) => !linkedIds.has(job.id));
  const selected = candidates.find((job) => job.id === selectedJob);
  return (
    <section
      className="model-linked-jobs"
      aria-label={`Linked jobs for ${modelName}`}
    >
      <Notice error>{linked.error}</Notice>
      {linked.loading ? (
        <span role="status">Loading linked jobs…</span>
      ) : linked.data.items.length === 0 ? (
        <span className="muted">No linked jobs</span>
      ) : (
        <ul>
          {linked.data.items.map((job) => (
            <li key={job.id}>
              <button
                className="text-button"
                title={`Open job ${job.id}`}
                onClick={() => go("jobs", job.id)}
              >
                {job.name}
              </button>{" "}
              <button
                className="text-button"
                disabled={busy}
                aria-label={`Unlink ${job.name}`}
                title="Remove link; keep the job and its results"
                onClick={() =>
                  act(
                    () =>
                      api(endpoints.models.job(modelId, job.id), {
                        method: "DELETE",
                      }),
                    "Job unlinked. Its results are kept.",
                  )
                }
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="secondary small"
        aria-expanded={adding}
        onClick={() => setAdding(!adding)}
      >
        {adding ? "Close job picker" : "Add jobs"}
      </button>
      {adding && (
        <div>
          <Notice error>{jobs.error}</Notice>
          <div className="model-job-picker">
            <select
              aria-label="Choose a job to link"
              value={selected?.id || ""}
              disabled={jobs.loading || busy}
              onChange={(event) => setSelectedJob(event.target.value)}
            >
              <option value="">
                {jobs.loading
                  ? "Loading jobs…"
                  : candidates.length
                    ? "Select a job…"
                    : "No unlinked jobs on this page"}
              </option>
              {candidates.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary small"
              disabled={busy || !selected}
              onClick={() => {
                if (!selected) return;
                void act(async () => {
                  await api(endpoints.models.job(modelId, selected.id), {
                    method: "POST",
                  });
                  setSelectedJob("");
                  setAdding(false);
                }, "Job linked to checkpoint.");
              }}
            >
              Add
            </button>
          </div>
          {jobs.data.total > 100 && (
            <div className="button-group">
              <button
                disabled={jobs.loading || offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 100))}
              >
                Previous jobs
              </button>
              <span>Page {Math.floor(offset / 100) + 1}</span>
              <button
                disabled={jobs.loading || offset + 100 >= jobs.data.total}
                onClick={() => setOffset(offset + 100)}
              >
                Next jobs
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
