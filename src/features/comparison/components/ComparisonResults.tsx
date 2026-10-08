import { download } from "@/api/artifacts";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

export function ComparisonResults(
  props: Pick<HubProps, "revision" | "act"> & { selected: string },
) {
  const { selected } = props;
  const detail = useRemote<Row>(
    selected ? endpoints.comparisons.detail(selected) : null,
    {},
    props.revision,
  );

  return (
    <Card
      title={detail.data.name || "Comparison result"}
      action={
        detail.data.report_artifact_id && (
          <button
            className="secondary"
            onClick={() =>
              props.act(
                () => download(detail.data.report_artifact_id),
                "Comparison report downloaded.",
              )
            }
          >
            Download report
          </button>
        )
      }
    >
      <Notice error>{detail.data.error || detail.error}</Notice>
      <Status value={detail.data.status} />
      {detail.data.result && (
        <>
          <Notice error={!detail.data.result.comparable}>
            {detail.data.result.comparable
              ? `Compared on ${detail.data.result.common_samples} common samples.`
              : detail.data.result.reasons.join(" · ")}
          </Notice>
          <Table
            rows={detail.data.result.rows}
            columns={[
              {
                key: "name",
                label: "Evaluation",
                render: (r) => (
                  <>
                    <strong>{r.name}</strong>
                    {detail.data.result.ranking[0] === r.evaluation_id && (
                      <small className="winner">Best by selected metric</small>
                    )}
                  </>
                ),
              },
              { key: "expected_samples", label: "Expected" },
              { key: "excluded_from_comparison", label: "Excluded" },
              {
                key: "far",
                label: "FAR",
                render: (r) => pct(r.metrics?.far),
              },
              {
                key: "frr",
                label: "FRR",
                render: (r) => pct(r.metrics?.frr),
              },
              {
                key: "delta",
                label: "FRR change",
                render: (r) =>
                  r.deltas?.frr != null
                    ? `${r.deltas.frr > 0 ? "+" : ""}${(r.deltas.frr * 100).toFixed(2)} pp`
                    : "—",
              },
              {
                key: "f2",
                label: "F2",
                render: (r) => pct(r.metrics?.f2_score),
              },
            ]}
          />
          <p className="muted">
            Ranking: {detail.data.result.metric}. Coverage:{" "}
            {detail.data.result.coverage_policy}. Threshold policy:{" "}
            {detail.data.result.threshold_policy}.
          </p>
        </>
      )}
    </Card>
  );
}
