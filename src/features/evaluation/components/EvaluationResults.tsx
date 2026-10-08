import { download } from "@/api/artifacts";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Chart } from "@/components/data-display/Chart";
import { Metrics } from "@/components/data-display/Metrics";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useRemote } from "@/hooks/useRemote";
import { number, pct, short } from "@/utils/format";

export function EvaluationResults(
  props: Pick<HubProps, "revision" | "act" | "go"> & { selected: string },
) {
  const { selected } = props;
  const detail = useRemote<Row>(
    selected ? endpoints.evaluations.detail(selected) : null,
    {},
    props.revision,
  );

  return (
    <Card
      title={detail.data.name || "Evaluation result"}
      action={
        <div className="button-group">
          <button
            className="secondary"
            onClick={() => props.go("jobs", detail.data.job_id)}
          >
            Job log
          </button>
          {detail.data.report_artifact_id && (
            <button
              className="secondary"
              onClick={() =>
                props.act(
                  () => download(detail.data.report_artifact_id),
                  "Report downloaded.",
                )
              }
            >
              Download report
            </button>
          )}
        </div>
      }
    >
      <Notice error>{detail.data.error || detail.error}</Notice>
      <Status value={detail.data.status} />
      {detail.data.result && (
        <>
          <Metrics values={detail.data.result.metrics} />
          <div className="diagnostics">
            {Object.entries(detail.data.result.diagnostics).map(
              ([key, value]) => (
                <span key={key}>
                  <strong>{String(value)}</strong> {key.replaceAll("_", " ")}
                </span>
              ),
            )}
          </div>
          <div className="two-columns">
            <Chart
              rows={detail.data.result.curves.roc}
              xKey="fpr"
              title="ROC curve · tampered is positive"
              lines={[
                {
                  key: "tpr",
                  label: "True positive rate",
                  color: "#23836c",
                },
              ]}
            />
            <div className="confusion">
              <h3>Confusion matrix</h3>
              <div>
                <span>
                  True genuine
                  <strong>{number(detail.data.result.metrics.tn)}</strong>
                </span>
                <span className="mistake">
                  False rejection
                  <strong>{number(detail.data.result.metrics.fp)}</strong>
                </span>
                <span className="mistake">
                  False acceptance
                  <strong>{number(detail.data.result.metrics.fn)}</strong>
                </span>
                <span>
                  True tampered
                  <strong>{number(detail.data.result.metrics.tp)}</strong>
                </span>
              </div>
            </div>
          </div>
          <Table
            rows={detail.data.result.slices}
            columns={[
              { key: "dimension", label: "Breakdown" },
              {
                key: "value",
                label: "Group",
                render: (r) => <span title={r.value}>{short(r.value)}</span>,
              },
              { key: "num_samples", label: "Scored" },
              { key: "far", label: "FAR", render: (r) => pct(r.far) },
              { key: "frr", label: "FRR", render: (r) => pct(r.frr) },
              {
                key: "f2_score",
                label: "F2",
                render: (r) => pct(r.f2_score),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
}
