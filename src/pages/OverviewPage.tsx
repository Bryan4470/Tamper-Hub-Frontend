import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page, type Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Status } from "@/components/ui/Status";
import { WorkspaceCards } from "@/features/overview/components/WorkspaceCards";
import { OverviewStats } from "@/features/overview/components/OverviewStats";
import { GpuProcessList } from "@/features/overview/components/GpuProcessList";
import { useRemote } from "@/hooks/useRemote";
import { number, short } from "@/utils/format";
import { terminal } from "@/utils/jobs";

export function OverviewPage(props: HubProps & { workers: Row[] }) {
  const jobs = useRemote<Page>(
    endpoints.jobs.list(),
    emptyPage,
    props.revision,
  );
  const active = jobs.data.items.filter((j) => !terminal(j.status));

  return (
    <>
      <div className="welcome-text">
        <span className="welcome-kicker">TAMPER DETECTION PLATFORM</span>
        <h1>Welcome to Tamper Hub</h1>
        <p>Train, evaluate, and compare your models with confidence.</p>
      </div>
      <WorkspaceCards go={props.go} />
      <OverviewStats {...props} activeJobs={active.length} />
      <div className="two-columns">
        <Card
          title="Recent activity"
          subtitle="The latest work across your workspace"
          action={
            <button className="text-button" onClick={() => props.go("jobs")}>
              View all →
            </button>
          }
        >
          {jobs.data.items.length ? (
            <Table
              rows={jobs.data.items.slice(0, 6)}
              columns={[
                {
                  key: "kind",
                  label: "Job",
                  render: (r) => (
                    <>
                      <strong>{r.kind}</strong>
                      <small className="subcell">{short(r.resource_id)}</small>
                    </>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Status value={r.status} />,
                },
              ]}
              onRow={(r) => props.go("jobs", r.id)}
            />
          ) : (
            <Empty title="Your first experiment starts here">
              Submitted jobs will appear here with their status.
            </Empty>
          )}
        </Card>
        <Card
          title="Compute resources"
          subtitle="Availability on the backend host"
        >
          {props.gpus.length ? (
            props.gpus.map((g) => (
              <div className="gpu-card" key={g.uuid}>
                <div>
                  <strong>{g.name}</strong>
                  <span>GPU {g.index}</span>
                </div>
                <progress max={g.memory_total_mb} value={g.memory_used_mb} />
                <small>
                  {number(g.memory_used_mb)} / {number(g.memory_total_mb)} MB{" "}
                  <span>
                    {g.reserved_by?.length ? "Reserved" : "No API reservation"}
                  </span>
                </small>
                <GpuProcessList processes={g.processes} />
              </div>
            ))
          ) : (
            <Empty title="CPU workspace">
              A CPU worker can run evaluation and inference. GPUs appear when
              available on the backend.
            </Empty>
          )}
        </Card>
      </div>
    </>
  );
}
