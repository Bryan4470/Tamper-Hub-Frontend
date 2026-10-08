import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import type {
  ReportPrediction,
  ReportSource,
} from "@/api/inferenceReportTypes";
import { SampleImage } from "@/components/data-display/SampleImage";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

type Rows = { items: ReportPrediction[]; total: number };
const outcomeNames: Record<string, string> = {
  fp: "False alarm",
  fn: "Missed tampering",
  failed: "Processing failure",
  tp: "Correct tampered",
  tn: "Correct genuine",
  unlabeled: "No saved label",
};

export function ReportPredictions({
  source,
  errors = false,
}: {
  source: ReportSource;
  errors?: boolean;
}) {
  const [outcome, setOutcome] = useState(errors ? "errors" : "");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ReportPrediction | null>(null);
  const rows = useRemote<Rows>(
    endpoints.inferenceReport.rows(source, offset, outcome, search),
    { items: [], total: 0 },
    0,
    30000,
  );
  return (
    <div>
      <div className="form-grid">
        <Field label="Search image filenames">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
              setSelected(null);
            }}
          />
        </Field>
        <Field label="Prediction filter">
          <select
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setOffset(0);
              setSelected(null);
            }}
          >
            {!errors && <option value="">All predictions</option>}
            <option value="errors">All misclassifications</option>
            <option value="fn">Missed tampering</option>
            <option value="fp">False alarms</option>
            <option value="failed">Processing failures</option>
            {!errors && (
              <>
                <option value="tp">Correct tampered</option>
                <option value="tn">Correct genuine</option>
                <option value="unlabeled">No saved label</option>
              </>
            )}
          </select>
        </Field>
      </div>
      <Notice error>{rows.error}</Notice>
      {rows.loading ? (
        <p role="status">Reading predictions…</p>
      ) : !rows.data.items.length ? (
        <Notice>
          No matching images. Error cases require known labels; processing
          failures are shown separately.
        </Notice>
      ) : (
        <>
          {errors ? (
            <div className="report-image-grid">
              {rows.data.items.map((row) => (
                <button
                  type="button"
                  className="report-image-card"
                  key={row.row_index}
                  onClick={() => setSelected(row)}
                >
                  <SampleImage
                    path={endpoints.inferenceReport.image(
                      source,
                      row.row_index,
                    )}
                  />
                  <strong>{outcomeNames[row.outcome]}</strong>
                  <span>{row.image_path.split("/").pop()}</span>
                  <small>Tamper probability: {pct(row.prob_tampered)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>True label</th>
                    <th>Prediction</th>
                    <th>Tamper probability</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data.items.map((row) => (
                    <tr key={row.row_index}>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setSelected(row)}
                        >
                          {row.image_path.split("/").pop()}
                        </button>
                      </td>
                      <td>{row.ground_truth || "Unknown"}</td>
                      <td>{row.prediction || "N/A"}</td>
                      <td>{pct(row.prob_tampered)}</td>
                      <td>{outcomeNames[row.outcome]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {selected && (
        <section className="report-image-detail" aria-label="Image details">
          <button
            type="button"
            className="secondary"
            onClick={() => setSelected(null)}
          >
            Close image details
          </button>
          <SampleImage
            path={endpoints.inferenceReport.image(source, selected.row_index)}
          />
          <p className="result-path">{selected.image_path}</p>
          <p>
            True label: <strong>{selected.ground_truth || "Unknown"}</strong> ·
            Prediction: <strong>{selected.prediction || "N/A"}</strong>
          </p>
          <p>
            Tamper probability: {pct(selected.prob_tampered)} · Applied
            threshold: {pct(selected.threshold)}
          </p>
          <Notice error>{selected.error}</Notice>
        </section>
      )}
      <div className="pagination">
        <span>{rows.data.total} matching images</span>
        <button
          disabled={!offset}
          onClick={() => {
            setOffset((v) => v - 24);
            setSelected(null);
          }}
        >
          Previous images
        </button>
        <button
          disabled={offset + 24 >= rows.data.total}
          onClick={() => {
            setOffset((v) => v + 24);
            setSelected(null);
          }}
        >
          Next images
        </button>
      </div>
    </div>
  );
}
