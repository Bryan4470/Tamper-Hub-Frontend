import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { SampleImage } from "@/components/data-display/SampleImage";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

export function PredictionResultPanel({
  item,
  go,
  revision,
}: {
  item: Row;
  go: HubProps["go"];
  revision: number;
}) {
  const result = useRemote<Row>(
    endpoints.predictions.detail(item.resource_id),
    {},
    revision,
    2000,
  );
  const prediction = result.data.prediction;

  return (
    <article className="prediction-output">
      <div className="prediction-output-head">
        <div>
          <strong>{item.label}</strong>
          <small>{item.resource_id}</small>
        </div>
        <Status value={result.data.status || "queued"} />
      </div>
      <Notice error>
        {result.error || result.data.error || prediction?.error}
      </Notice>
      {result.data.status === "succeeded" && prediction && (
        <div className="prediction-output-body">
          <div className="prediction-image">
            <SampleImage path={endpoints.predictions.image(item.resource_id)} />
          </div>
          <div>
            <span className={`prediction-verdict ${prediction.prediction}`}>
              {prediction.prediction}
            </span>
            <dl className="prediction-metrics">
              <div>
                <dt>Tamper probability</dt>
                <dd>{pct(prediction.prob_tampered)}</dd>
              </div>
              <div>
                <dt>Genuine probability</dt>
                <dd>{pct(prediction.prob_genuine)}</dd>
              </div>
              <div>
                <dt>Threshold</dt>
                <dd>{pct(prediction.threshold)}</dd>
              </div>
              <div>
                <dt>Card type</dt>
                <dd>{prediction.card_type?.replaceAll("_", " ")}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
      {prediction && (
        <button
          className="secondary"
          onClick={() =>
            go(
              "gradcam",
              JSON.stringify({
                image_path: prediction.image_path,
                card_type: prediction.card_type,
                model_id: prediction.model_id,
              }),
            )
          }
        >
          View Grad-CAM
        </button>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => go("jobs", result.data.job_id || item.job_id)}
      >
        View job and logs →
      </button>
    </article>
  );
}
