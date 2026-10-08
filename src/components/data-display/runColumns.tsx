import type { Row } from "@/api/types";
import { Status } from "@/components/ui/Status";
import { pct, short } from "@/utils/format";

export const runColumns = [
  {
    key: "name",
    label: "Experiment",
    render: (r: Row) => (
      <>
        <strong>{r.name}</strong>
        <small className="subcell">{short(r.id)}</small>
      </>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (r: Row) => <Status value={r.status} />,
  },
  {
    key: "progress",
    label: "Progress",
    render: (r: Row) => (
      <div className="progress-cell">
        <progress max="1" value={r.progress || 0} />
        <span>{pct(r.progress || 0)}</span>
      </div>
    ),
  },
  {
    key: "created_at",
    label: "Created",
    render: (r: Row) => new Date(r.created_at).toLocaleString(),
  },
];
