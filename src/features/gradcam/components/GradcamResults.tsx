import { useState } from "react";
import { download } from "@/api/artifacts";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SampleImage } from "@/components/data-display/SampleImage";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

export function GradcamResults({
  props,
  selected,
}: {
  props: HubProps;
  selected: string;
}) {
  const [offset, setOffset] = useState(0);
  const result = useRemote<Row>(
    selected ? endpoints.gradcam.detail(selected) : null,
    {},
    props.revision,
    2000,
  );
  return (
    <Card title={result.data.name || "Grad-CAM results"}>
      <Notice error>{result.error}</Notice>
      {selected && (
        <>
          <p role="status">
            {result.data.status} {result.data.phase}
          </p>
          <Notice error>{result.data.error}</Notice>
          {result.data.job_id && (
            <button
              className="secondary"
              onClick={() => props.go("jobs", result.data.job_id)}
            >
              View job and logs
            </button>
          )}
          <p className="result-path">{result.data.checkpoint_path}</p>
          {result.data.output_dir && (
            <p className="result-path">
              Output location: {result.data.output_dir}
            </p>
          )}
          {result.data.total != null && (
            <p>
              {result.data.total} images · {result.data.failures || 0} failed
            </p>
          )}
          {(result.data.items || [])
            .slice(offset, offset + 12)
            .map((item: Row, index: number) => (
              <article
                key={item.artifact_id || index}
                className="gradcam-result"
              >
                <p className="result-path">{item.image_path}</p>
                {item.error ? (
                  <Notice error>{item.error}</Notice>
                ) : (
                  <>
                    <SampleImage
                      alt="Input image, tamper Grad-CAM, and genuine Grad-CAM side by side"
                      path={endpoints.artifacts.download(item.artifact_id)}
                    />
                    <p>
                      {item.prediction} · Tamper {pct(item.prob_tampered)} ·
                      Genuine {pct(item.prob_genuine)} · Threshold{" "}
                      {pct(item.threshold)} · {item.card_type}
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        void props.act(
                          () =>
                            download(
                              item.artifact_id,
                              "gradcam_" + (index + offset) + ".png",
                            ),
                          "Visualization downloaded.",
                        )
                      }
                    >
                      Download visualization
                    </button>
                  </>
                )}
              </article>
            ))}
          {result.data.items?.length > 12 && (
            <div className="pagination">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 12))}
              >
                Previous images
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 12, result.data.items.length)}{" "}
                of {result.data.items.length}
              </span>
              <button
                disabled={offset + 12 >= result.data.items.length}
                onClick={() => setOffset(offset + 12)}
              >
                Next images
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
