import { useState, useEffect, useRef } from "react";
import { endpoints } from "@/api/endpoints";
import type { SavedTable } from "@/api/studioTypes";
import { SampleImage } from "@/components/data-display/SampleImage";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { csvDisplayName } from "@/utils/csvDisplayName";
import { pct } from "@/utils/format";

const outcomes: Record<string, string> = {
  "": "All images",
  tp: "TP · Correct tamper",
  tn: "TN · Correct genuine",
  fp: "FP · False rejection",
  fn: "FN · Missed tamper",
  excluded: "Excluded / unavailable labels",
};
export function EpochImageViewer({
  runId,
  artifactId,
  csv,
  initialCell,
  revision,
  onClose,
}: {
  runId: string;
  artifactId: string;
  csv: string;
  initialCell: string;
  revision: number;
  onClose: () => void;
}) {
  const viewer = useRef<HTMLElement>(null);
  useEffect(() => {
    viewer.current?.focus({ preventScroll: true });
  }, []);
  const [cell, setCell] = useState(initialCell);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const remote = useRemote<SavedTable>(
    endpoints.studio.csvImages(runId, artifactId, csv, cell, offset),
    { items: [], columns: [], total: 0, unfiltered: 0, offset: 0, limit: 12 },
    revision,
    60000,
  );
  return (
    <section
      className="epoch-image-viewer"
      aria-label="CSV image viewer"
      tabIndex={-1}
      ref={viewer}
    >
      <div className="form-actions">
        <h4>{csvDisplayName(csv)}</h4>
        <button type="button" className="secondary" onClick={onClose}>
          Close image viewer
        </button>
      </div>
      <Field label="Image outcome">
        <select
          value={cell}
          onChange={(event) => {
            setCell(event.target.value);
            setOffset(0);
            setExpanded(null);
          }}
        >
          {Object.entries(outcomes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Notice error>{remote.error}</Notice>
      {remote.loading ? (
        <p role="status">Loading saved images…</p>
      ) : (
        <>
          <p>
            {remote.data.total} matching images · {outcomes[cell]}. Images are
            read from the server; predictions are from the saved epoch.
          </p>
          {!remote.data.total && !remote.error && (
            <p>No images match this CSV and outcome.</p>
          )}
          <div className="epoch-image-grid">
            {remote.data.items.map((row, index) => {
              const position = Number(row._row_index);
              const path = String(row.image_path || "");
              return (
                <article
                  key={`${position}:${index}`}
                  className={expanded === position ? "expanded" : ""}
                >
                  <button
                    type="button"
                    className="epoch-image-open"
                    aria-label={`Enlarge ${path.split("/").pop()}`}
                    onClick={() =>
                      setExpanded(expanded === position ? null : position)
                    }
                  >
                    <SampleImage
                      key={path}
                      path={endpoints.studio.predictionImage(
                        runId,
                        artifactId,
                        position,
                      )}
                      alt={path.split("/").pop() || "Saved image"}
                    />
                  </button>
                  <p title={path}>{path.split("/").pop()}</p>
                  <p>
                    {outcomes[String(row.confusion_cell)] ||
                      "Unavailable outcome"}
                  </p>
                  <small>
                    Label:{" "}
                    {String(
                      row.ground_truth ?? row.ground_truth_index ?? "N/A",
                    )}{" "}
                    · Prediction:{" "}
                    {String(row.prediction ?? row.prediction_index ?? "N/A")}
                  </small>
                  <small>
                    Tamper probability: {pct(row.prob_tampered)} · Threshold:{" "}
                    {row.threshold == null ? "N/A" : String(row.threshold)}
                  </small>
                </article>
              );
            })}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={offset === 0}
              onClick={() => {
                setOffset(Math.max(0, offset - 12));
                setExpanded(null);
              }}
            >
              Previous images
            </button>
            <span>Page {Math.floor(offset / 12) + 1}</span>
            <button
              type="button"
              className="secondary"
              disabled={offset + 12 >= remote.data.total}
              onClick={() => {
                setOffset(offset + 12);
                setExpanded(null);
              }}
            >
              Next images
            </button>
          </div>
        </>
      )}
    </section>
  );
}
