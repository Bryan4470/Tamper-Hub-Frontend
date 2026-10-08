import { useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { HubProps } from "@/app/types";
import { BusyButton } from "@/components/ui/BusyButton";
import { Field } from "@/components/ui/Field";

export function PredictionImportForm(
  props: Pick<HubProps, "datasets" | "busy" | "act"> & {
    selectedModel: string;
    onImported: (id: string) => void;
  },
) {
  const { selectedModel } = props;
  const [importPath, setImportPath] = useState(""),
    [importDataset, setImportDataset] = useState("");

  return (
    <details className="disclosure">
      <summary>Import existing prediction CSVs</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.act(async () => {
            const item = await submit(
              endpoints.artifacts.importPredictions,
              {
                path: importPath,
                model_id: selectedModel,
                dataset_id: importDataset,
              },
              false,
            );
            props.onImported(item.id);
          }, "Predictions imported; missing samples are recorded as failures.");
        }}
      >
        <div className="form-grid">
          <Field label="Prediction CSV path">
            <input
              required
              value={importPath}
              onChange={(e) => setImportPath(e.target.value)}
              placeholder="/path/to/inference_out.csv"
            />
          </Field>
          <Field label="Source dataset">
            <select
              required
              value={importDataset}
              onChange={(e) => setImportDataset(e.target.value)}
            >
              <option value="">Select dataset</option>
              {props.datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="muted">
          Uses the model selected above. CSV columns: image_path and
          prob_tampered.
        </p>
        <BusyButton busy={props.busy} disabled={!selectedModel}>
          Import predictions
        </BusyButton>
      </form>
    </details>
  );
}
