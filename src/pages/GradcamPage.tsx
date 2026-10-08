import { useState } from "react";
import type { HubProps } from "@/app/types";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import { useRemote } from "@/hooks/useRemote";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { DeleteJobButton } from "@/features/jobs/components/DeleteJobButton";
import { GradcamForm } from "@/features/gradcam/components/GradcamForm";
import { GradcamResults } from "@/features/gradcam/components/GradcamResults";

export function GradcamPage(props: HubProps) {
  const [selected, setSelected] = useState(
    props.target && !props.target.startsWith("{") ? props.target : "",
  );
  const runs = useRemote<Page>(
    endpoints.gradcam.list(),
    emptyPage,
    props.revision,
    5000,
  );
  return (
    <div>
      {selected && (
        <>
          <div className="form-actions">
            <button className="secondary" onClick={() => setSelected("")}>
              ← Back to Grad-CAM runs
            </button>
          </div>
          <GradcamResults key={selected} props={props} selected={selected} />
        </>
      )}
      <div hidden={Boolean(selected)}>
        <GradcamForm props={props} onSubmitted={setSelected} />
        <Card title="Grad-CAM runs" className="inference-run-list">
          <Notice error>{runs.error}</Notice>
          {runs.data.items.length ? (
            <Table
              rows={runs.data.items}
              onRow={(row) => setSelected(row.id)}
              columns={[
                {
                  key: "name",
                  label: "Run",
                  render: (row) => (
                    <>
                      <strong>{row.name || row.id}</strong>
                      <small className="result-path">
                        {row.request?.input_path}
                      </small>
                    </>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                { key: "total", label: "Images" },
                { key: "failures", label: "Failed" },
                {
                  key: "delete",
                  label: "Actions",
                  render: (row) => (
                    <DeleteJobButton
                      jobId={row.job_id}
                      status={row.status}
                      name={row.name || row.id}
                      busy={props.busy}
                      act={props.act}
                      onDeleted={() => {
                        if (selected === row.id) setSelected("");
                      }}
                    />
                  ),
                },
              ]}
            />
          ) : (
            <Empty title="No Grad-CAM runs yet">
              Choose a checkpoint and input above to generate visualizations.
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
