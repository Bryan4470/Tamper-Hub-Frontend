import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { download } from "@/api/artifacts";
import { emptyPage, type Page, type Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useRemote } from "@/hooks/useRemote";
import { InferenceReport } from "@/features/inference/components/InferenceReport";
import { describeRun } from "@/features/inference/utils/runDescription";
import { pct, short } from "@/utils/format";

type PredictionPage = Page & {
  summary?: {
    genuine: number;
    tampered: number;
    failed: number;
    total: number;
  };
};

export function InferenceRunDetails(
  props: Pick<HubProps, "revision" | "go" | "act" | "models" | "datasets"> & {
    selected: string;
  },
) {
  const { selected } = props;
  const [offset, setOffset] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const details = useRemote<Row>(
    selected ? endpoints.inference.detail(selected) : null,
    {},
    props.revision,
  );
  const results = useRemote<PredictionPage>(
    selected ? endpoints.inference.predictions(selected, offset) : null,
    emptyPage,
    props.revision,
  );
  const summary = results.data.summary;
  const display = describeRun(details.data, props.models, props.datasets);

  if (details.data.output_dir)
    return (
      <Card
        title={display.name}
        subtitle={
          display.input
            ? `${display.description} · ${display.input}`
            : undefined
        }
        action={
          <button
            className="secondary"
            onClick={() => props.go("jobs", details.data.job_id)}
          >
            Open job log
          </button>
        }
      >
        <InferenceReport
          go={props.go}
          source={{ runId: selected }}
          act={props.act}
          revision={props.revision}
        />
      </Card>
    );

  return (
    <Card
      title={display.name}
      subtitle={
        display.input ? `${display.description} · ${display.input}` : undefined
      }
      action={
        <button
          className="secondary"
          onClick={() => props.go("jobs", details.data.job_id)}
        >
          Open job log
        </button>
      }
    >
      <Notice error>
        {details.error || details.data.error || results.error}
      </Notice>
      <div className="detail-summary">
        <Status value={details.data.status} />
        <span>{details.data.processed_samples || 0} processed</span>
        <span>{details.data.failed_samples || 0} failures</span>
      </div>
      {summary && summary.total > 0 && (
        <section
          aria-label="Prediction summary"
          className="notice"
          aria-live="polite"
        >
          <strong>
            {details.data.status === "succeeded" ? "Summary" : "Summary so far"}
            : {summary.genuine} genuine, {summary.tampered} tampered (
            {summary.total} total)
          </strong>
          {summary.failed > 0 && (
            <p>
              {summary.failed} failed predictions, included in the total above.
            </p>
          )}
        </section>
      )}
      {details.data.prediction_artifact_ids?.length > 0 && (
        <div className="form-actions">
          {(details.data.prediction_artifact_ids as string[]).map(
            (id, index) => (
              <button
                key={id}
                className="secondary"
                onClick={() =>
                  props.act(
                    () =>
                      download(
                        id,
                        details.data.request?.output_name ||
                          `predictions_${index + 1}.csv`,
                      ),
                    "Predictions downloaded.",
                  )
                }
              >
                Download results CSV
                {details.data.prediction_artifact_ids.length > 1
                  ? ` ${index + 1}`
                  : ""}
              </button>
            ),
          )}
          <button
            className="primary"
            onClick={() =>
              props.go(
                "evaluation",
                details.data.prediction_artifact_ids.join(","),
              )
            }
          >
            Evaluate saved predictions →
          </button>
        </div>
      )}
      {details.data.prediction_artifact_ids?.length > 0 && (
        <details
          className="inner-details"
          onToggle={(event) => setReportOpen(event.currentTarget.open)}
        >
          <summary>Full results report</summary>
          {reportOpen && (
            <InferenceReport
              go={props.go}
              source={{ runId: selected }}
              act={props.act}
              revision={props.revision}
            />
          )}
        </details>
      )}
      {results.data.items.length > 0 && (
        <Table
          rows={results.data.items}
          columns={[
            {
              key: "sample_id",
              label: "Sample",
              render: (r) => (
                <code title={r.image_path}>{short(r.sample_id)}</code>
              ),
            },
            { key: "card_type", label: "Card type" },
            { key: "ground_truth", label: "Ground truth" },
            { key: "prediction", label: "Prediction" },
            {
              key: "prob_tampered",
              label: "Tamper probability",
              render: (r) => pct(r.prob_tampered),
            },
            { key: "error", label: "Error" },
            {
              key: "gradcam",
              label: "Explain",
              render: (r) => (
                <button
                  className="text-button"
                  onClick={() =>
                    props.go(
                      "gradcam",
                      JSON.stringify({
                        image_path: r.image_path,
                        card_type: r.card_type,
                        model_id: props.models.some((m) => m.id === r.model_id)
                          ? r.model_id
                          : undefined,
                        checkpoint_path: details.data.request?.checkpoint_path,
                      }),
                    )
                  }
                >
                  View Grad-CAM
                </button>
              ),
            },
          ]}
        />
      )}
      <div className="pagination">
        <span>{results.data.total} predictions</span>
        <button disabled={!offset} onClick={() => setOffset((o) => o - 25)}>
          Previous
        </button>
        <button
          disabled={offset + 25 >= results.data.total}
          onClick={() => setOffset((o) => o + 25)}
        >
          Next
        </button>
      </div>
    </Card>
  );
}
