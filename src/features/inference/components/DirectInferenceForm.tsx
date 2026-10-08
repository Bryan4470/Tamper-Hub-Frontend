import { useState } from "react";
import type { FormEvent } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { SavedCheckpointList } from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { DeviceSelect } from "@/components/forms/DeviceSelect";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { ThresholdOverrideField } from "@/features/inference/components/ThresholdOverrideField";

import { inferenceName } from "@/features/inference/utils/runDescription";

const inputTypes = {
  image: {
    label: "Single image",
    placeholder: "/path/to/image.jpg",
    hint: "Full path to one image on the server.",
  },
  directory: {
    label: "Image folder",
    placeholder: "/path/to/images",
    hint: "Runs all supported images in this folder and its subfolders.",
  },
  csv: {
    label: "CSV file",
    placeholder: "/path/to/data.csv",
    hint: "Requires an image_path column. Relative image paths are resolved from the CSV's folder.",
  },
  csv_dir: {
    label: "CSV folder",
    placeholder: "/path/to/csv_folder",
    hint: "Runs every CSV in this folder and its subfolders. Each CSV needs an image_path column.",
  },
  batch_config: {
    label: "Batch YAML",
    placeholder: "/path/to/batch.yaml",
    hint: "Runs the CSV files listed under csv_files in your batch YAML.",
  },
} as const;
type InputType = keyof typeof inputTypes;

export function DirectInferenceForm(
  props: Pick<HubProps, "models" | "gpus" | "busy" | "act" | "revision"> & {
    initialModel: string;
    onCreated: (id: string) => void;
  },
) {
  const saved = useRemote<SavedCheckpointList>(
    endpoints.studio.checkpoints,
    { items: [] },
    props.revision,
    60000,
  );
  const [modelSource, setModelSource] = useState<"saved" | "path">("saved");
  const [modelChoice, setModelChoice] = useState(
    props.initialModel ? `model:${props.initialModel}` : "",
  );
  const [checkpoint, setCheckpoint] = useState("");
  const [config, setConfig] = useState("");
  const [inputType, setInputType] = useState<InputType>("directory");
  const [inputPath, setInputPath] = useState("");
  const [card, setCard] = useState("mykadfront");
  const [crop, setCrop] = useState(false);
  const [device, setDevice] = useState("cpu");
  const [batchSize, setBatchSize] = useState(32);
  const [label, setLabel] = useState("");
  const [thresholdOverride, setThresholdOverride] = useState<{
    source: string;
    value: string;
  } | null>(null);
  const [output, setOutput] = useState("inference_out.csv");
  const [saveFull, setSaveFull] = useState(true);
  const [outputRoot, setOutputRoot] = useState<string | null>(null);
  const [outputPrefix, setOutputPrefix] = useState("results");
  const outputSettings = useRemote<{ results_root?: string }>(
    endpoints.inferenceReport.options,
    {},
    0,
    60000,
  );
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const savedCheckpoint = saved.data.items.find(
    (item) => `saved:${item.id}` === modelChoice,
  );
  const selectedCheckpointPath =
    savedCheckpoint?.checkpoint_path ||
    props.models.find((item) => `model:${item.id}` === modelChoice)
      ?.checkpoint_path;

  const model =
    modelSource === "path"
      ? {
          checkpoint_path: checkpoint.trim(),
          config_path: config.trim() || null,
        }
      : savedCheckpoint
        ? {
            checkpoint_path: savedCheckpoint.checkpoint_path,
            config_path: savedCheckpoint.config_path,
          }
        : { model_id: modelChoice.slice("model:".length) };

  const defaultsPath =
    model.model_id || model.checkpoint_path
      ? endpoints.inference.defaults(model)
      : null;
  const thresholdSource = `${defaultsPath}:${card}`;
  const threshold =
    thresholdOverride?.source === thresholdSource
      ? thresholdOverride.value
      : "";

  const generatedName = inferenceName(
    inputPath,
    modelSource === "path"
      ? checkpoint
      : selectedCheckpointPath ||
          props.models.find((item) => `model:${item.id}` === modelChoice)
            ?.name ||
          "",
    card,
  );

  function start(event: FormEvent) {
    event.preventDefault();
    setError("");
    props.act(async () => {
      try {
        const result = await submit(endpoints.inference.direct, {
          ...model,
          name: name.trim() || generatedName,
          input_type: inputType,
          input_path: inputPath.trim(),
          card_type: card,
          crop,
          device,
          batch_size: batchSize,
          default_label: label || null,
          threshold: threshold === "" ? null : Number(threshold),
          output_name: saveFull ? "inference_out.csv" : output.trim(),
          save_full_results: saveFull,
          output_root: saveFull ? outputRoot?.trim() || null : null,
          output_prefix: saveFull
            ? outputPrefix.trim() || "results"
            : "results",
        });
        props.onCreated(result.resource_id);
      } catch (cause) {
        setError((cause as Error).message);
        throw cause;
      }
    }, "Inference queued.");
  }

  return (
    <Card
      title="Predict images"
      subtitle="Choose a checkpoint and your input. No dataset or model registration needed."
    >
      <form onSubmit={start} aria-label="Direct inference">
        <div className="section-label">
          <span className="section-number">1</span> Choose a checkpoint
        </div>
        <Field label="Checkpoint source">
          <select
            value={modelSource}
            onChange={(event) =>
              setModelSource(event.target.value as "saved" | "path")
            }
          >
            <option value="saved">Choose a saved checkpoint</option>
            <option value="path">Enter a checkpoint path</option>
          </select>
        </Field>
        {modelSource === "saved" ? (
          <>
            <Field label="Saved checkpoint">
              <select
                required
                value={modelChoice}
                onChange={(event) => setModelChoice(event.target.value)}
              >
                <option value="">Choose a checkpoint</option>
                <optgroup label="Models">
                  {props.models.map((model) => (
                    <option key={model.id} value={`model:${model.id}`}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Training checkpoints">
                  {saved.data.items.map((item) => (
                    <option key={item.id} value={`saved:${item.id}`}>
                      {item.run_name} · {item.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
            {selectedCheckpointPath && (
              <p className="notice">
                Checkpoint file: <code>{selectedCheckpointPath}</code>
              </p>
            )}
            <Notice error>{saved.error}</Notice>
            {!saved.loading &&
              !props.models.length &&
              !saved.data.items.length && (
                <p className="muted">
                  No saved checkpoints found. Select “Enter a checkpoint path”
                  above.
                </p>
              )}
          </>
        ) : (
          <div className="form-grid">
            <Field label="Checkpoint file">
              <input
                required
                value={checkpoint}
                onChange={(event) => setCheckpoint(event.target.value)}
                placeholder="/path/to/checkpoint.pth"
              />
            </Field>
            <Field
              label="Configuration file (optional)"
              hint="Uses config.yaml beside the checkpoint or in its run folder; otherwise the server's default config."
            >
              <input
                value={config}
                onChange={(event) => setConfig(event.target.value)}
                placeholder="Auto-detect config.yaml"
              />
            </Field>
          </div>
        )}
        <div className="section-label">
          <span className="section-number">2</span> Choose your input
        </div>
        <div className="form-grid">
          <Field label="Input type">
            <select
              value={inputType}
              onChange={(event) => {
                setInputType(event.target.value as InputType);
                setError("");
              }}
            >
              {Object.entries(inputTypes).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Card type for inference"
            hint="Used for images and CSV rows without a card_type value."
          >
            <select
              value={card}
              onChange={(event) => setCard(event.target.value)}
            >
              <option value="mykadfront">MyKad front</option>
              <option value="mykadback">MyKad back</option>
              <option value="mykadfront_2026">MyKad front 2026</option>
              <option value="mykadback_2026">MyKad back 2026</option>
            </select>
          </Field>
        </div>
        <Field label="Input path on server" hint={inputTypes[inputType].hint}>
          <input
            required
            value={inputPath}
            onChange={(event) => setInputPath(event.target.value)}
            placeholder={inputTypes[inputType].placeholder}
          />
        </Field>
        {inputType === "batch_config" && (
          <details className="inner-details">
            <summary>Batch YAML example</summary>
            <pre>
              {
                "base_dir: /path/to/csv_folder\ncsv_files:\n  - genuine.csv\n  - tamper.csv"
              }
            </pre>
            <p className="muted">
              An omitted or relative base_dir uses the backend project folder.
              Missing CSV files are reported before starting.
            </p>
          </details>
        )}
        <label className="check-field">
          <input
            type="checkbox"
            checked={crop}
            onChange={(event) => setCrop(event.target.checked)}
          />
          Crop cards before prediction
        </label>
        <div className="section-label">
          <span className="section-number">3</span> Run and save results
        </div>
        <DeviceSelect value={device} onChange={setDevice} gpus={props.gpus} />
        <label className="check-field">
          <input
            type="checkbox"
            checked={saveFull}
            onChange={(event) => setSaveFull(event.target.checked)}
          />
          Save full results
        </label>
        <p className="muted">
          Save predictions, evaluation reports, and misclassified images.
          Evaluation requires known labels.
        </p>
        {saveFull && (
          <div className="form-grid">
            <Field
              label="Output location on server"
              hint="Choose an absolute server folder. Each run gets a new timestamped subfolder; missing folders are created automatically."
            >
              <input
                value={outputRoot ?? outputSettings.data.results_root ?? ""}
                onChange={(event) => setOutputRoot(event.target.value)}
                placeholder={
                  outputSettings.data.results_root ||
                  "Loading default location…"
                }
              />
              {outputRoot !== null && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setOutputRoot(null)}
                >
                  Use default location
                </button>
              )}
            </Field>
            <Field
              label="Output folder name"
              hint={`Saved to ${outputRoot?.trim() || outputSettings.data.results_root || "results"}/${outputPrefix || "results"}_<timestamp>/`}
            >
              <input
                value={outputPrefix}
                maxLength={80}
                pattern="[A-Za-z0-9][A-Za-z0-9_\-]*"
                onChange={(event) => setOutputPrefix(event.target.value)}
                placeholder="results"
              />
            </Field>
          </div>
        )}
        <details className="inner-details">
          <summary>Result name and advanced options</summary>
          <div className="form-grid">
            <Field
              label="Inference run name"
              hint="Leave blank to use the input name, checkpoint, and card type."
            >
              <input
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={generatedName}
              />
            </Field>
            {!saveFull && (
              <Field
                label="Results CSV filename"
                hint="Saved with the job and available to download when ready."
              >
                <input
                  required
                  maxLength={120}
                  pattern="[A-Za-z0-9][A-Za-z0-9_.\-]*\.csv"
                  value={output}
                  onChange={(event) => setOutput(event.target.value)}
                />
              </Field>
            )}
            <Field label="Images per batch">
              <input
                type="number"
                min={1}
                max={1024}
                required
                value={batchSize}
                onChange={(event) => setBatchSize(Number(event.target.value))}
              />
            </Field>
            <Field label="Known label (optional)">
              <select
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              >
                <option value="">Unknown / use CSV labels</option>
                <option value="genuine">Genuine</option>
                <option value="tamper">Tampered</option>
              </select>
            </Field>
            <ThresholdOverrideField
              key={thresholdSource}
              defaultsPath={defaultsPath}
              card={card}
              override={threshold}
              onChange={(value) =>
                setThresholdOverride({ source: thresholdSource, value })
              }
            />
          </div>
        </details>
        <Notice error>{error}</Notice>
        <p className="muted">
          Results are saved automatically. You can follow progress in Jobs and
          download the predictions here.
        </p>
        <BusyButton
          busy={props.busy}
          disabled={
            !inputPath.trim() ||
            (modelSource === "path" ? !checkpoint.trim() : !modelChoice)
          }
        >
          Run inference
        </BusyButton>
      </form>
    </Card>
  );
}
