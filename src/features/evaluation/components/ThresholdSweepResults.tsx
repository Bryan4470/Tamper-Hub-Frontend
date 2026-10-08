import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page, type Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

export function ThresholdSweepResults(
  props: Pick<HubProps, "revision"> & {
    sweepId: string;
    onSelect: (id: string) => void;
    onApply: (card: string, value: number) => void;
  },
) {
  const { sweepId } = props;
  const sweeps = useRemote<Page>(
    endpoints.sweeps.list(100),
    emptyPage,
    props.revision,
  );

  const sweep = useRemote<Row>(
    sweepId ? endpoints.sweeps.detail(sweepId) : null,
    {},
    props.revision,
  );

  if (!sweeps.data.items.length) return null;

  return (
    <Card
      title="Threshold tuning"
      action={
        <select
          aria-label="Select threshold sweep"
          value={sweepId}
          onChange={(e) => props.onSelect(e.target.value)}
        >
          <option value="">Select sweep</option>
          {sweeps.data.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.status}
            </option>
          ))}
        </select>
      }
    >
      {sweepId ? (
        <>
          <Status value={sweep.data.status} />
          <Notice error>{sweep.data.error}</Notice>
          {sweep.data.result && (
            <>
              <p className="muted">{sweep.data.result.selection_policy}</p>
              <Table
                rows={Object.entries(sweep.data.result.recommendations).map(
                  ([card, value]) => ({ card, ...((value as Row) || {}) }),
                )}
                columns={[
                  { key: "card", label: "Card type" },
                  {
                    key: "threshold",
                    label: "Recommended threshold",
                    render: (r) => r.threshold ?? "Insufficient evidence",
                  },
                  { key: "far", label: "FAR", render: (r) => pct(r.far) },
                  { key: "frr", label: "FRR", render: (r) => pct(r.frr) },
                  {
                    key: "apply",
                    label: "",
                    render: (r) =>
                      r.threshold !== undefined && (
                        <button
                          className="secondary small"
                          onClick={() => props.onApply(r.card, r.threshold)}
                        >
                          Apply to evaluation form
                        </button>
                      ),
                  },
                ]}
              />
            </>
          )}
        </>
      ) : (
        <p className="muted">Select a sweep to inspect its recommendations.</p>
      )}
    </Card>
  );
}
