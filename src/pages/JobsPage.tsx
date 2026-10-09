import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { JobName } from "@/features/jobs/components/JobName";
import { JobDetails } from "@/features/jobs/components/JobDetails";
import { useRemote } from "@/hooks/useRemote";
import { pct, short } from "@/utils/format";

export function JobsPage(props: HubProps) {
  const [filter, setFilter] = useState(""),
    [selected, setSelected] = useState(props.target);
  const jobs = useRemote<Page>(
    endpoints.jobs.list(filter),
    emptyPage,
    props.revision,
  );

  return (
    <div className="workspace-grid jobs-workspace">
      <Card
        title="All jobs"
        action={
          <select
            aria-label="Filter jobs by status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "queued",
              "preparing",
              "running",
              "succeeded",
              "failed",
              "cancelled",
              "interrupted",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        }
      >
        <Notice error>{jobs.error}</Notice>
        {jobs.data.items.length ? (
          <Table
            rows={jobs.data.items}
            selected={selected}
            columns={[
              {
                key: "name",
                label: "Experiment / run",
                render: (r) => (
                  <>
                    <JobName
                      id={r.id}
                      name={r.name || `${r.kind} job`}
                      onSelect={() => setSelected(r.id)}
                      act={props.act}
                      busy={props.busy}
                    />
                    <small className="subcell">
                      {r.kind} · {short(r.id)}
                    </small>
                  </>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Status value={r.status} />,
              },
              {
                key: "progress",
                label: "Progress",
                render: (r) => pct(r.progress),
              },
              { key: "phase", label: "Activity" },
              {
                key: "device",
                label: "Device",
                render: (r) => short(r.device),
              },
            ]}
          />
        ) : (
          <Empty title="No jobs to show">
            Submitted work appears here and continues after you close the
            browser.
          </Empty>
        )}
      </Card>
      <div>
        {selected ? (
          <JobDetails
            {...props}
            key={selected}
            selected={selected}
            onDeleted={() => setSelected("")}
          />
        ) : (
          <Card title="Job details">
            <Empty title="Select a job">
              Choose a job to follow its progress, inspect logs, or cancel
              queued work.
            </Empty>
          </Card>
        )}
      </div>
    </div>
  );
}
