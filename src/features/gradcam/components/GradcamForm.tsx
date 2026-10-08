import { InferenceUploadInput } from "@/features/inference/components/InferenceUploadInput";
import { DeviceSelect } from "@/components/forms/DeviceSelect";
import { BusyButton } from "@/components/ui/BusyButton";
import { useState } from "react";
import { api, submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { SavedCheckpointList } from "@/api/studioTypes";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Field } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { requestId } from "@/utils/requestId";

export function GradcamForm({
  props,
  onSubmitted,
}: {
  props: HubProps;
  onSubmitted: (id: string) => void;
}) {
  const initial: Row = (() => {
    try {
      return JSON.parse(props.target || "{}");
    } catch {
      return {};
    }
  })();
  const [modelSource, setModelSource] = useState("saved");
  const [inputSource, setInputSource] = useState("server");
  const [checkpoint, setCheckpoint] = useState(initial.checkpoint_path || "");
  const [modelChoice, setModelChoice] = useState(
    initial.model_id
      ? `model:${initial.model_id}`
      : initial.checkpoint_path
        ? `checkpoint:${initial.checkpoint_path}`
        : "",
  );
  const [configOverride, setConfigOverride] = useState(
    initial.config_path || "",
  );
  const [outputRoot, setOutputRoot] = useState<string | null>(null);
  const [outputPrefix, setOutputPrefix] = useState("gradcam");
  const outputSettings = useRemote<{ results_root?: string }>(
    endpoints.inferenceReport.options,
    {},
    0,
    60000,
  );
  const [name, setName] = useState("Grad-CAM");
  const [inputType, setInputType] = useState("image");
  const [path, setPath] = useState(initial.image_path || "");
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [card, setCard] = useState(initial.card_type || "mykadfront");
  const [device, setDevice] = useState("cpu");
  const [limit, setLimit] = useState("50");
  const [threshold, setThreshold] = useState("");
  const checkpoints = useRemote<SavedCheckpointList>(
    endpoints.studio.checkpoints,
    { items: [] },
    props.revision,
    60000,
  );
  const modelId =
    modelSource === "saved" && modelChoice.startsWith("model:")
      ? modelChoice.slice(6)
      : "";
  const selectedCheckpoint =
    modelSource === "path"
      ? checkpoint
      : modelChoice.startsWith("checkpoint:")
        ? modelChoice.slice(11)
        : "";
  const chosen = checkpoints.data.items.find(
    (c) => c.checkpoint_path === selectedCheckpoint,
  );
  const displayedPath = modelId
    ? props.models.find((m) => m.id === modelId)?.checkpoint_path
    : selectedCheckpoint;
  return (
    <Card
      title="Generate Grad-CAM"
      subtitle="Choose a checkpoint and your input. Inspect the regions contributing to each class decision."
    >
      <p>
        Inspect the input, tamper attribution, and genuine attribution side by
        side. Heatmaps explain class attribution; they are not tamper
        segmentation masks.
      </p>
      <Notice error>{checkpoints.error}</Notice>
      <form
        aria-label="Grad-CAM"
        onSubmit={(event) => {
          event.preventDefault();
          void props.act(async () => {
            const body = {
              name,
              output_root: outputRoot?.trim() || null,
              output_prefix: outputPrefix.trim() || "gradcam",
              ...(modelId
                ? { model_id: modelId }
                : {
                    checkpoint_path: selectedCheckpoint,
                    config_path: configOverride || chosen?.config_path,
                  }),
              input_type:
                inputSource === "upload"
                  ? "image"
                  : inputSource === "folder"
                    ? "directory"
                    : inputType,
              input_path: path || "upload",
              card_type: card,
              device,
              limit: limit ? Number(limit) : null,
              threshold: threshold ? Number(threshold) : null,
            };
            let accepted: Row;
            if (inputSource === "folder") {
              const data = new FormData();
              data.append("request", JSON.stringify(body));
              for (const image of folderFiles)
                data.append(
                  "files",
                  image,
                  image.webkitRelativePath || image.name,
                );
              accepted = await api(endpoints.gradcam.uploads, {
                method: "POST",
                body: data,
                headers: { "Idempotency-Key": requestId() },
              });
            } else if (inputSource === "upload" && file) {
              const data = new FormData();
              data.append("request", JSON.stringify(body));
              data.append("file", file);
              accepted = await api(endpoints.gradcam.upload, {
                method: "POST",
                body: data,
                headers: { "Idempotency-Key": requestId() },
              });
            } else accepted = await submit(endpoints.gradcam.create, body);
            onSubmitted(accepted.resource_id);
          }, "Grad-CAM queued.");
        }}
      >
        <div className="section-label">
          <span className="section-number">1</span> Choose a checkpoint
        </div>
        <Field label="Checkpoint source">
          <select
            value={modelSource}
            onChange={(e) => setModelSource(e.target.value)}
          >
            <option value="saved">Choose a saved checkpoint</option>
            <option value="path">Enter a checkpoint path</option>
          </select>
        </Field>
        {modelSource === "saved" && (
          <Field label="Saved checkpoint">
            <select
              required
              value={modelChoice}
              onChange={(e) => {
                setModelChoice(e.target.value);
                setConfigOverride("");
              }}
            >
              <option value="">Choose a checkpoint</option>
              <optgroup label="Models">
                {props.models.map((m) => (
                  <option key={m.id} value={`model:${m.id}`}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Training checkpoints">
                {selectedCheckpoint && !chosen && (
                  <option value={`checkpoint:${selectedCheckpoint}`}>
                    {selectedCheckpoint}
                  </option>
                )}
                {checkpoints.data.items.map((c) => (
                  <option key={c.id} value={`checkpoint:${c.checkpoint_path}`}>
                    {c.run_name} · {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
        )}
        {modelSource === "path" && (
          <Field label="Checkpoint file">
            <input
              required
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value)}
              placeholder="/path/to/checkpoint.pth"
            />
          </Field>
        )}
        {!modelId && (
          <Field label="Configuration override (optional)">
            <input
              value={configOverride}
              placeholder={
                chosen?.config_path || "Use checkpoint's saved config"
              }
              onChange={(e) => setConfigOverride(e.target.value)}
            />
          </Field>
        )}
        {displayedPath && (
          <p className="notice">
            Checkpoint file: <code>{displayedPath}</code>
          </p>
        )}
        <div className="section-label">
          <span className="section-number">2</span> Choose your input
        </div>
        <Field label="Input source">
          <select
            value={inputSource}
            onChange={(e) => {
              setInputSource(e.target.value);
              setFolderFiles([]);
              setFile(null);
            }}
          >
            <option value="server">Server path</option>
            <option value="upload">Upload image</option>
            <option value="folder">Upload image folder</option>
          </select>
        </Field>
        <div className="form-grid">
          {inputSource === "server" && (
            <Field label="Input type">
              <select
                value={inputType}
                onChange={(e) => {
                  setInputType(e.target.value);
                  setFile(null);
                }}
              >
                <option value="image">Single image</option>
                <option value="csv">CSV</option>
                <option value="directory">Image folder</option>
              </select>
            </Field>
          )}
          <Field label="Card type">
            <select value={card} onChange={(e) => setCard(e.target.value)}>
              {[
                "mykadfront",
                "mykadback",
                "mykadfront_2026",
                "mykadback_2026",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        {inputSource === "server" ? (
          <Field label="Server input path">
            <input
              required={!file}
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setFile(null);
              }}
            />
          </Field>
        ) : inputSource === "folder" ? (
          <InferenceUploadInput
            folder
            files={folderFiles}
            onChange={setFolderFiles}
          />
        ) : (
          <Field
            label="Or upload image"
            hint="Choose one image from your computer, up to 20 MB."
          >
            <input
              required
              type="file"
              accept=".jpg,.jpeg,.png,.bmp,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
        )}
        <div className="section-label">
          <span className="section-number">3</span> Run and save results
        </div>
        <DeviceSelect value={device} onChange={setDevice} gpus={props.gpus} />
        <div className="form-grid">
          <Field
            label="Output location on server"
            hint="Choose an absolute server folder. Each run gets a new timestamped subfolder; missing folders are created automatically."
          >
            <input
              value={outputRoot ?? outputSettings.data.results_root ?? ""}
              onChange={(e) => setOutputRoot(e.target.value)}
              placeholder={
                outputSettings.data.results_root || "Loading default location…"
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
            hint={`Saved to ${outputRoot?.trim() || outputSettings.data.results_root || "results"}/${outputPrefix || "gradcam"}_<timestamp>/`}
          >
            <input
              value={outputPrefix}
              maxLength={80}
              pattern="[A-Za-z0-9][A-Za-z0-9_\-]*"
              onChange={(e) => setOutputPrefix(e.target.value)}
              placeholder="gradcam"
            />
          </Field>
        </div>
        <details className="inner-details">
          <summary>Result name and advanced options</summary>
          <div className="form-grid">
            <Field label="Experiment name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>{" "}
            <Field label="Image limit (blank for all)">
              <input
                type="number"
                min="1"
                max="10000"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </Field>{" "}
            <Field label="Threshold (blank uses checkpoint config)">
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
          </div>
        </details>
        <p className="muted">
          Visualizations are saved automatically. Follow progress in Jobs and
          download the images from the results.
        </p>
        <BusyButton
          busy={props.busy}
          disabled={
            (modelSource === "saved" ? !modelChoice : !checkpoint.trim()) ||
            (inputSource === "folder"
              ? !folderFiles.length
              : inputSource === "upload"
                ? !file
                : !path.trim())
          }
        >
          Generate visualization
        </BusyButton>
      </form>
    </Card>
  );
}
