import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { number } from "@/utils/format";

export function OverviewStats(
  props: Pick<HubProps, "datasets" | "models"> & {
    workers: Row[];
    activeJobs: number;
  },
) {
  return (
    <div className="overview-metrics">
      {[
        [
          "Registered datasets",
          props.datasets.length,
          "Snapshots in the Hub workspace",
        ],
        ["Model checkpoints", props.models.length, "Ready for inference"],
        ["Active jobs", props.activeJobs, "Queued and running"],
        [
          "Workers online",
          props.workers.filter((w) => w.online && w.status !== "stopped")
            .length,
          "CPU and GPU executors",
        ],
      ].map(([label, count, hint]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{number(count)}</strong>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}
