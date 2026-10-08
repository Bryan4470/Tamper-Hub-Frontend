import { requestId } from "@/utils/requestId";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api, submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page, type Row } from "@/api/types";
import type { SavedCheckpointList } from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PredictionResultPanel } from "@/features/inference/components/PredictionResultPanel";
import { useRemote } from "@/hooks/useRemote";

type CheckpointChoice = {
  id: string;
  sourceId: string;
  sourceName: string;
  name: string;
  checkpointPath: string;
  configPath: string;
  modelId?: string;
};

export function SinglePredictionForm(
  props: Pick<HubProps, "models" | "busy" | "act" | "go" | "revision"> & {
    device: string;
    crop: boolean;
    singleModel: string;
    setSingleModel: (id: string) => void;
  },
) {
  const { device, crop, singleModel, setSingleModel } = props;
  const saved = useRemote<SavedCheckpointList>(
    endpoints.studio.checkpoints,
    { items: [] },
    props.revision,
    60000,
  );
  const savedPaths = useRemote<Page>(
    endpoints.inferencePaths.list(1000),
    emptyPage,
    props.revision,
    60000,
  );
  const choices = useMemo<CheckpointChoice[]>(
    () => [
      ...props.models.map((model) => ({
        id: `registered:${model.id}`,
        sourceId: `registered:${model.id}`,
        sourceName: model.name,
        name:
          model.checkpoint_path?.split("/").pop() || "Registered checkpoint",
        checkpointPath: model.checkpoint_path,
        configPath: model.config_path,
        modelId: model.id,
      })),
      ...saved.data.items.map((checkpoint) => ({
        id: checkpoint.id,
        sourceId: `run:${checkpoint.run_id}`,
        sourceName: checkpoint.run_name,
        name: checkpoint.name,
        checkpointPath: checkpoint.checkpoint_path,
        configPath: checkpoint.config_path,
      })),
    ],
    [props.models, saved.data.items],
  );
  const sources = [
    ...new Map(choices.map((choice) => [choice.sourceId, choice])).values(),
  ];
  const [sourceId, setSourceId] = useState(
    singleModel ? `registered:${singleModel}` : "",
  );
  const sourceChoices = choices.filter(
    (choice) => choice.sourceId === sourceId,
  );
  const [checkpointId, setCheckpointId] = useState("");
  const [inputMethod, setInputMethod] = useState<"upload" | "path" | "saved">(
    "upload",
  );
  const [uploadScope, setUploadScope] = useState<"single" | "multiple">(
    "single",
  );
  const [files, setFiles] = useState<File[]>([]),
    [serverPath, setServerPath] = useState(""),
    [pathLabel, setPathLabel] = useState(""),
    [savedPathId, setSavedPathId] = useState(""),
    [card, setCard] = useState("mykadfront"),
    [queued, setQueued] = useState<Row[]>([]);
  const selectedCheckpoint =
    sourceChoices.find((choice) => choice.id === checkpointId) ||
    sourceChoices[0];
  useEffect(() => {
    if (singleModel) setSourceId(`registered:${singleModel}`);
  }, [singleModel]);
  useEffect(() => {
    if (!sourceId && sources[0]) setSourceId(sources[0].sourceId);
  }, [sourceId, sources]);
  useEffect(() => {
    setCheckpointId(sourceChoices[0]?.id || "");
  }, [sourceId, sourceChoices[0]?.id]);

  function predict(e: FormEvent) {
    e.preventDefault();
    props.act(
      async () => {
        if (!selectedCheckpoint) throw new Error("Choose a model checkpoint.");
        let modelId = selectedCheckpoint.modelId;
        if (!modelId) {
          modelId = props.models.find(
            (model) =>
              model.checkpoint_path === selectedCheckpoint.checkpointPath,
          )?.id;
        }
        if (!modelId) {
          const registered = await submit(
            endpoints.models.create,
            {
              name: `${selectedCheckpoint.sourceName} · ${selectedCheckpoint.name}`,
              checkpoint_path: selectedCheckpoint.checkpointPath,
              config_path: selectedCheckpoint.configPath,
            },
            false,
          );
          modelId = registered.id;
        }
        if (!modelId)
          throw new Error("Unable to register the selected checkpoint.");
        setSingleModel(modelId);
        const inputs: Array<{ file?: File; path?: string; label: string }> =
          inputMethod === "upload"
            ? files.map((file) => ({ file, label: file.name }))
            : [
                {
                  path:
                    inputMethod === "saved"
                      ? savedPaths.data.items.find(
                          (item) => item.id === savedPathId,
                        )?.path
                      : serverPath.trim(),
                  label:
                    inputMethod === "saved"
                      ? savedPaths.data.items.find(
                          (item) => item.id === savedPathId,
                        )?.label || "Saved path"
                      : serverPath.trim().split("/").pop() || serverPath.trim(),
                },
              ];
        const results: Row[] = [];
        for (const input of inputs) {
          const data = new FormData();
          if (input.file) data.append("file", input.file);
          else data.append("image_path", input.path || "");
          data.append("model_id", modelId);
          data.append("card_type", card);
          data.append("device", device);
          data.append("crop", String(crop));
          const result = await api(endpoints.predictions.create, {
            method: "POST",
            body: data,
            headers: { "Idempotency-Key": requestId() },
          });
          results.push({ ...result, label: input.label });
        }
        setQueued(results);
      },
      `${inputMethod === "upload" && files.length > 1 ? files.length : 1} prediction job(s) queued.`,
    );
  }

  return (
    <Card
      title="Inspect one image"
      subtitle="Choose a model and checkpoint, then upload an image or use a path visible to the backend."
    >
      <form onSubmit={predict}>
        <Notice error>{saved.error || savedPaths.error}</Notice>
        <div className="form-grid">
          <Field label="Model">
            <select
              required
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {!sources.length && <option value="">No models available</option>}
              {sources.map((source) => (
                <option key={source.sourceId} value={source.sourceId}>
                  {source.sourceName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Checkpoint">
            <select
              required
              value={selectedCheckpoint?.id || ""}
              onChange={(event) => setCheckpointId(event.target.value)}
            >
              {sourceChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="input-method">
          <legend>Image source</legend>
          <label>
            <input
              type="radio"
              name="single-input-method"
              checked={inputMethod === "upload"}
              onChange={() => setInputMethod("upload")}
            />
            Upload image
          </label>
          <label>
            <input
              type="radio"
              name="single-input-method"
              checked={inputMethod === "path"}
              onChange={() => setInputMethod("path")}
            />
            Use server path
          </label>
          <label>
            <input
              type="radio"
              name="single-input-method"
              checked={inputMethod === "saved"}
              onChange={() => setInputMethod("saved")}
            />
            Saved path
          </label>
        </fieldset>
        {inputMethod === "upload" && (
          <fieldset className="input-method compact">
            <legend>Upload amount</legend>
            <label>
              <input
                type="radio"
                name="upload-scope"
                checked={uploadScope === "single"}
                onChange={() => {
                  setUploadScope("single");
                  setFiles([]);
                }}
              />
              Single image
            </label>
            <label>
              <input
                type="radio"
                name="upload-scope"
                checked={uploadScope === "multiple"}
                onChange={() => {
                  setUploadScope("multiple");
                  setFiles([]);
                }}
              />
              Multiple images
            </label>
          </fieldset>
        )}
        <div className="form-grid">
          <Field label="Card type">
            <select value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="mykadfront">MyKad front</option>
              <option value="mykadback">MyKad back</option>
              <option value="mykadfront_2026">MyKad front 2026</option>
              <option value="mykadback_2026">MyKad back 2026</option>
            </select>
          </Field>
          {inputMethod === "upload" ? (
            <Field label="Image upload">
              <input
                type="file"
                multiple={uploadScope === "multiple"}
                accept="image/jpeg,image/png,image/bmp,image/webp"
                onChange={(e) =>
                  setFiles(
                    Array.from(e.target.files || []).slice(
                      0,
                      uploadScope === "single" ? 1 : undefined,
                    ),
                  )
                }
              />
              {files.length > 0 && <small>{files.length} image(s) ready</small>}
            </Field>
          ) : inputMethod === "path" ? (
            <Field
              label="Server image path"
              hint="Absolute path accessible to the API, for example /mnt5/dataset/tamper/example.jpg."
            >
              <input
                value={serverPath}
                onChange={(event) => setServerPath(event.target.value)}
                placeholder="/mnt5/dataset/tamper/image.jpg"
              />
            </Field>
          ) : (
            <Field label="Saved server path">
              <select
                required
                value={savedPathId}
                onChange={(event) => setSavedPathId(event.target.value)}
              >
                <option value="">Choose a saved path</option>
                {savedPaths.data.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} · {item.path}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {inputMethod === "path" && (
          <div className="save-path-row">
            <input
              value={pathLabel}
              onChange={(event) => setPathLabel(event.target.value)}
              placeholder="Saved path label"
              aria-label="Saved path label"
            />
            <button
              type="button"
              className="secondary"
              disabled={!pathLabel.trim() || !serverPath.trim() || props.busy}
              onClick={() =>
                props.act(async () => {
                  const savedPath = await submit(
                    endpoints.inferencePaths.create,
                    { label: pathLabel.trim(), path: serverPath.trim() },
                    false,
                  );
                  setSavedPathId(savedPath.id);
                  setPathLabel("");
                  setInputMethod("saved");
                }, "Server image path saved.")
              }
            >
              Save path
            </button>
          </div>
        )}
        <BusyButton
          busy={props.busy}
          disabled={
            !selectedCheckpoint ||
            (inputMethod === "upload"
              ? !files.length
              : inputMethod === "path"
                ? !serverPath.trim()
                : !savedPathId)
          }
        >
          Predict image
        </BusyButton>
      </form>
      {queued.length > 0 && (
        <section className="prediction-results" aria-label="Prediction results">
          <div className="prediction-results-title">
            <strong>Inference output</strong>
            <span>{queued.length} image(s)</span>
          </div>
          {queued.map((item) => (
            <PredictionResultPanel
              key={item.resource_id}
              item={item}
              go={props.go}
              revision={props.revision}
            />
          ))}
        </section>
      )}
    </Card>
  );
}
