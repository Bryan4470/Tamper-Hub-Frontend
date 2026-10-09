import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { NotebookItem } from "@/api/notebookTypes";
import type { HubProps } from "@/app/types";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";

type LinkedJob = { id: string; name: string; unavailable?: boolean };
export function NotebookJobs({
  item,
  disabled,
  go,
  onUpdated,
}: {
  item: NotebookItem;
  disabled: boolean;
  go: HubProps["go"];
  onUpdated: (ids: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState("");
  const [linked, setLinked] = useState<LinkedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idsKey = JSON.stringify(item.linkedJobIds || []);
  useEffect(() => {
    let active = true;
    const ids: string[] = JSON.parse(idsKey);
    setLoading(true);
    void Promise.all(
      ids.map(async (id) => {
        try {
          return await api<LinkedJob>(endpoints.jobs.detail(id));
        } catch {
          return { id, name: `Unavailable job (${id})`, unavailable: true };
        }
      }),
    ).then((values) => {
      if (active) {
        setLinked(values);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [idsKey]);
  const jobs = useRemote<Page>(
    adding ? `${endpoints.jobs.list("", 100)}&offset=${offset}` : null,
    emptyPage,
    0,
    30000,
  );
  const ids = new Set(item.linkedJobIds || []);
  const candidates = jobs.data.items.filter((job) => !ids.has(job.id));
  const selectedJob = candidates.find((job) => job.id === selected);
  async function change(jobId: string, remove: boolean) {
    setBusy(true);
    setError("");
    try {
      if (!remove) await api(endpoints.jobs.detail(jobId));
      const saved = await api<NotebookItem>(
        endpoints.notebookItems.job(item.id, jobId),
        { method: remove ? "DELETE" : "POST" },
      );
      onUpdated(saved.linkedJobIds || []);
      if (!remove) {
        setSelected("");
        setAdding(false);
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="model-linked-jobs"
      aria-label={`Linked jobs for ${item.title}`}
    >
      <Notice error>{error}</Notice>
      {loading ? (
        <span role="status">Loading linked jobs…</span>
      ) : !linked.length ? (
        <span className="muted">No linked jobs</span>
      ) : (
        <ul>
          {linked.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                className="text-button"
                disabled={job.unavailable || disabled || busy}
                onClick={() => go("jobs", job.id)}
              >
                {job.name}
              </button>{" "}
              <button
                type="button"
                className="text-button"
                aria-label={`Unlink ${job.name}`}
                disabled={disabled || busy}
                onClick={() => void change(job.id, true)}
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
        disabled={disabled || busy}
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
              value={selectedJob?.id || ""}
              disabled={disabled || busy || jobs.loading}
              onChange={(event) => setSelected(event.target.value)}
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
              disabled={disabled || busy || !selectedJob}
              onClick={() => {
                if (selectedJob) void change(selectedJob.id, false);
              }}
            >
              Add
            </button>
          </div>
          {jobs.data.total > 100 && (
            <div className="button-group">
              <button
                disabled={!offset || jobs.loading}
                onClick={() => setOffset(Math.max(0, offset - 100))}
              >
                Previous jobs
              </button>
              <span>Page {offset / 100 + 1}</span>
              <button
                disabled={offset + 100 >= jobs.data.total || jobs.loading}
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
