import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { SavedRun } from "@/api/studioTypes";
import type { Page, Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { DeleteJobButton } from "@/features/jobs/components/DeleteJobButton";
import { Notice } from "@/components/ui/Notice";

export function DeleteSavedRunButton({
  run,
  busy,
  act,
  onDeleted,
}: {
  run: SavedRun;
  onDeleted: () => void;
} & Pick<HubProps, "busy" | "act">) {
  const [job, setJob] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setJob(null);
    setError("");
    async function resolve() {
      let resource: Row | undefined;
      if (run.inference_id) {
        resource = await api<Row>(
          endpoints.inference.detail(run.inference_id),
          { signal: controller.signal },
        );
      } else {
        const collection =
          run.kind === "inference" ? endpoints.inference : endpoints.training;
        for (let offset = 0; ; offset += 100) {
          const page = await api<Page>(
            `${collection.list(100)}&offset=${offset}`,
            { signal: controller.signal },
          );
          resource = page.items.find((value) =>
            [value.output_dir, value.artifact_dir].some(
              (path) =>
                typeof path === "string" &&
                path.replace(/\/+$/, "") === run.directory.replace(/\/+$/, ""),
            ),
          );
          if (resource || offset + 100 >= page.total || !page.items.length)
            break;
        }
      }
      if (resource?.job_id) {
        const value = await api<Row>(endpoints.jobs.detail(resource.job_id), {
          signal: controller.signal,
        });
        if (active) setJob(value);
      }
    }
    void resolve()
      .catch((reason) => {
        if (active)
          setError(
            `Could not load deletion details: ${(reason as Error).message}`,
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [run.id, run.inference_id, run.directory, run.kind]);
  return (
    <div>
      <DeleteJobButton
        jobId={job?.id}
        status={job?.status}
        name={run.name}
        busy={busy || loading}
        act={act}
        onDeleted={onDeleted}
      />
      <Notice error>{error}</Notice>
    </div>
  );
}
