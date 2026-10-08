import { useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { SampleImage } from "@/components/data-display/SampleImage";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { short } from "@/utils/format";

export function DatasetPreview(
  props: Pick<HubProps, "revision" | "busy" | "act" | "go"> & {
    selected: string;
  },
) {
  const { selected } = props;
  const [offset, setOffset] = useState(0);
  const preview = useRemote<Page>(
    selected ? endpoints.datasets.preview(selected, offset) : null,
    emptyPage,
    props.revision,
    30000,
  );

  return (
    <Card
      title="Sample preview"
      subtitle="Select a dataset above to inspect its samples."
      action={
        <button
          className="secondary"
          disabled={props.busy}
          onClick={() =>
            props.act(async () => {
              const j = await submit(endpoints.datasets.validate(selected), {});
              props.go("jobs", j.job_id);
            }, "Dataset validation queued.")
          }
        >
          Validate images
        </button>
      }
    >
      <Notice error>{preview.error}</Notice>
      <div className="sample-grid">
        {preview.data.items.map((r) => (
          <div className="sample" key={r.sample_id}>
            <SampleImage path={r.image_url} />
            <div>
              <strong>{r.fraud_type || "Unlabeled"}</strong>
              <span>{r.card_type}</span>
              <small>{short(r.sample_id)}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="pagination">
        <span>
          {offset + 1}–{Math.min(offset + 12, preview.data.total)} of{" "}
          {preview.data.total}
        </span>
        <button
          disabled={!offset}
          onClick={() => setOffset((o) => Math.max(0, o - 12))}
        >
          Previous
        </button>
        <button
          disabled={offset + 12 >= preview.data.total}
          onClick={() => setOffset((o) => o + 12)}
        >
          Next
        </button>
      </div>
    </Card>
  );
}
