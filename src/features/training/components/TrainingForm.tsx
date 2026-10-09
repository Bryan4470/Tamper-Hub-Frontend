import { TrainingEvaluationSettings } from "@/features/training/components/TrainingEvaluationSettings";
import {
  evaluationSettings,
  thresholdPrefix,
  farKey,
} from "@/features/training/utils/evaluationSettings";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { DeviceSelect } from "@/components/forms/DeviceSelect";
import { WorkflowStepper } from "@/components/forms/WorkflowStepper";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { number } from "@/utils/format";
import {
  DatasetSelection,
  type DatasetMode,
  type DatasetSource,
} from "@/features/training/components/DatasetSelection";
import { TrainingConfigurationFields } from "@/features/training/components/TrainingConfigurationFields";

const steps = ["Compute", "Datasets", "Configuration", "Review"];

type DatasetSourceResponse = {
  items: DatasetSource[];
};

function configuredDatasets(
  datasets: Row[],
  sources: DatasetSource[],
  role: "train" | "test",
) {
  const configured = new Set(
    sources
      .filter((source) => source.configured && source.role === role)
      .map((source) => source.path),
  );
  if (!configured.size) return [];
  const hasRole = (dataset: Row) =>
    role === "train"
      ? dataset.dataset_role !== "test"
      : dataset.dataset_role === "test";

  const newestFirst = [...datasets].sort((left, right) => {
    const leftCreated =
      Date.parse(left.created_at || left.updated_at || "") || 0;
    const rightCreated =
      Date.parse(right.created_at || right.updated_at || "") || 0;
    return rightCreated - leftCreated;
  });
  const exactCollection = newestFirst.find((dataset) => {
    const paths = Array.isArray(dataset.source_paths)
      ? new Set(dataset.source_paths as string[])
      : new Set<string>();
    return (
      hasRole(dataset) &&
      paths.size === configured.size &&
      [...paths].every((path) => configured.has(path))
    );
  });
  if (exactCollection) return [exactCollection.id];

  const selectedBySource = new Map<string, string>();
  for (const dataset of newestFirst) {
    const path =
      typeof dataset.source_path === "string" ? dataset.source_path : null;
    if (
      hasRole(dataset) &&
      typeof path === "string" &&
      configured.has(path) &&
      !selectedBySource.has(path)
    ) {
      selectedBySource.set(path, dataset.id);
    }
  }
  return [...selectedBySource.values()];
}

export function TrainingForm(
  props: Pick<HubProps, "datasets" | "gpus" | "busy" | "act" | "revision"> & {
    onCreated: (id: string) => void;
  },
) {
  const configs = useRemote<Row>(
    endpoints.training.configs,
    { items: [] },
    props.revision,
    30000,
  );
  const datasetSources = useRemote<DatasetSourceResponse>(
    endpoints.datasetSources,
    { items: [] },
    props.revision,
    30000,
  );
  const [name, setName] = useState(""),
    [config, setConfig] = useState("config.yaml");
  const [train, setTrain] = useState<string[]>([]),
    [val] = useState<string[]>([]),
    [test, setTest] = useState<string[]>([]);
  const [datasetMode, setDatasetMode] = useState<DatasetMode>("config");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [device, setDevice] = useState("cpu"),
    [configYaml, setConfigYaml] = useState("");
  const [outputRoot, setOutputRoot] = useState<string | null>(null);
  const outputLocation = outputRoot?.trim() || configs.data.output_root || "";
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [validation, setValidation] = useState<Row | null>(null);
  const [step, setStep] = useState(0),
    [reached, setReached] = useState(0),
    [error, setError] = useState("");
  const appliedDatasetDefaults = useRef(false);
  const appliedConfigDefault = useRef(false);
  const materializedDatasets = useRef(new Map<string, string>());
  useEffect(() => {
    if (appliedDatasetDefaults.current || datasetSources.loading) return;
    setTrain(
      configuredDatasets(props.datasets, datasetSources.data.items, "train"),
    );
    setTest(
      configuredDatasets(props.datasets, datasetSources.data.items, "test"),
    );
    setSelectedSources(
      datasetSources.data.items
        .filter((source) => source.configured)
        .map((source) => source.path),
    );
    appliedDatasetDefaults.current = true;
  }, [datasetSources.data.items, datasetSources.loading, props.datasets]);
  useEffect(() => {
    if (appliedConfigDefault.current) return;
    const selected = configs.data.items.find((item: Row) => item.id === config);
    if (typeof selected?.content === "string") {
      setConfigYaml(selected.content);
      appliedConfigDefault.current = true;
    }
  }, [config, configs.data.items]);
  const body = (
    datasetIds: { train: string[]; test: string[] } = { train, test },
  ) => ({
    name,
    config_id: config,
    output_root: outputRoot?.trim() || null,
    train_dataset_ids: datasetIds.train,
    validation_dataset_ids: val,
    test_dataset_ids: datasetIds.test,
    device,
    config_yaml: configYaml,
    overrides,
  });
  const sourcePaths = (role: "train" | "test") =>
    datasetSources.data.items
      .filter(
        (source) =>
          source.role === role &&
          (datasetMode === "config"
            ? source.configured
            : selectedSources.includes(source.path)),
      )
      .map((source) => source.path);
  async function effectiveDatasetIds() {
    async function resolve(role: "train" | "test", existing: string[]) {
      const paths = sourcePaths(role);
      if (datasetMode === "config" && existing.length) return existing;
      if (!paths.length) return [];
      const key = `${role}:${[...paths].sort().join("|")}`;
      const savedId = materializedDatasets.current.get(key);
      if (savedId) return [savedId];
      const created = (await submit(
        endpoints.datasetCollections,
        {
          name: `${name.trim() || "Training run"} · ${role === "train" ? "training" : "testing"}`,
          source_paths: paths,
        },
        false,
      )) as Row;
      materializedDatasets.current.set(key, created.id);
      return [created.id];
    }
    const [effectiveTrain, effectiveTest] = await Promise.all([
      resolve("train", train),
      resolve("test", test),
    ]);
    return { train: effectiveTrain, test: effectiveTest };
  }
  const hasTrainingData =
    datasetMode === "config"
      ? train.length > 0 || sourcePaths("train").length > 0
      : sourcePaths("train").length > 0;
  function configurationError() {
    if (!name.trim()) return "Enter an experiment name.";
    if (outputRoot?.trim() && !outputRoot.trim().startsWith("/"))
      return "Output location must be an absolute server folder path.";
    if (!config) return "Choose a configuration template.";
    if (!configYaml.trim()) return "Configuration YAML cannot be empty.";
    const values = evaluationSettings(selectedTemplate, overrides);
    if (
      values.thresholds.some(
        ({ value }) => !Number.isFinite(value) || value < 0 || value > 1,
      )
    )
      return "Each tamper threshold must be a number between 0 and 1.";
    if (!Number.isFinite(values.far) || values.far < 0 || values.far > 1)
      return "FAR constraint must be a number between 0% and 100%.";
    return "";
  }
  function next() {
    const issue =
      step === 1 && !hasTrainingData
        ? "Select at least one training dataset."
        : step === 2
          ? configurationError()
          : "";
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    setStep(Math.min(step + 1, 3));
    setReached(Math.max(reached, Math.min(step + 1, 3)));
  }
  function start(e: FormEvent) {
    e.preventDefault();
    if (step !== 3) {
      next();
      return;
    }
    const issue = !hasTrainingData
      ? "Select at least one training dataset."
      : configurationError();
    if (issue) {
      setError(issue);
      return;
    }
    props.act(async () => {
      const saved = await submit(
        endpoints.training.create,
        body(await effectiveDatasetIds()),
      );
      props.onCreated(saved.resource_id);
    }, "Training job queued. Follow its progress in the training runs panel.");
  }
  const selectedTemplate =
    configs.data.items.find((item: Row) => item.id === config) || {};
  const effectiveEvaluation = evaluationSettings(selectedTemplate, overrides);
  return (
    <Card
      title="Configure an experiment"
      subtitle="Set up your training run in four steps."
    >
      <WorkflowStepper
        steps={steps}
        current={step}
        reached={reached}
        onChange={(index) => {
          setStep(index);
          setError("");
        }}
      />
      <form
        onSubmit={start}
        noValidate
        onChange={() => {
          setValidation(null);
          setError("");
        }}
      >
        <fieldset
          className="wizard-panel"
          disabled={step !== 0}
          hidden={step !== 0}
        >
          <legend>Step 1: Select compute</legend>
          <p>Choose the worker that will run this experiment.</p>
          <DeviceSelect value={device} onChange={setDevice} gpus={props.gpus} />
          <div className="compute-options">
            <button
              type="button"
              className={
                device === "cpu" ? "compute-option selected" : "compute-option"
              }
              aria-pressed={device === "cpu"}
              onClick={() => {
                setDevice("cpu");
                setValidation(null);
              }}
            >
              <strong>CPU</strong>
              <span>Use a CPU worker</span>
            </button>
            {props.gpus.map((gpu) => (
              <button
                type="button"
                key={gpu.uuid}
                className={
                  device === gpu.uuid
                    ? "compute-option selected"
                    : "compute-option"
                }
                aria-pressed={device === gpu.uuid}
                onClick={() => {
                  setDevice(gpu.uuid);
                  setValidation(null);
                }}
              >
                <strong>{gpu.name}</strong>
                <span>
                  GPU {gpu.index} ·{" "}
                  {number(gpu.memory_total_mb - gpu.memory_used_mb)} MB free
                </span>
                <small>
                  {gpu.reserved_by?.length
                    ? "Reserved · jobs will queue"
                    : "No API reservation"}
                </small>
              </button>
            ))}
          </div>
          <p className="muted">
            A worker for the selected device must be running before a queued job
            can start.
          </p>
        </fieldset>
        <fieldset
          className="wizard-panel"
          disabled={step !== 1}
          hidden={step !== 1}
        >
          <legend>Step 2: Select datasets</legend>
          <p>
            Use the CSV files selected by your template, or create a custom
            selection for this run.
          </p>
          <DatasetSelection
            mode={datasetMode}
            sources={datasetSources.data.items}
            selected={selectedSources}
            onModeChange={setDatasetMode}
            onSelectedChange={setSelectedSources}
          />
          <p className="muted">
            Validation is created automatically from the selected training CSVs
            using the configured validation split.
          </p>
        </fieldset>
        <fieldset
          className="wizard-panel"
          disabled={step !== 2}
          hidden={step !== 2}
        >
          <legend>Step 3: Training configuration</legend>
          <Notice error>{configs.error}</Notice>
          <Field label="Experiment name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="RGB + Cb · front and back"
            />
          </Field>
          <Field label="Configuration template">
            <select
              value={config}
              onChange={(e) => {
                const next = e.target.value;
                setConfig(next);
                setOverrides({});
                const selected = configs.data.items.find(
                  (item: Row) => item.id === next,
                );
                setConfigYaml(selected?.content || "");
              }}
            >
              {!configs.data.items.some((item: Row) => item.id === config) && (
                <option value={config}>{config}</option>
              )}
              {configs.data.items.map((item: Row) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Output location on server"
            hint="Config, checkpoints, and reports are saved in an experiment_name_<timestamp> subfolder. Missing folders are created automatically."
          >
            <input
              value={outputRoot ?? configs.data.output_root ?? ""}
              onChange={(e) => setOutputRoot(e.target.value)}
              placeholder={
                configs.data.output_root || "Loading default location…"
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
          <TrainingConfigurationFields
            template={selectedTemplate}
            overrides={overrides}
            onChange={(key, value) =>
              setOverrides((current) => ({ ...current, [key]: value }))
            }
          />
          <TrainingEvaluationSettings
            template={selectedTemplate}
            overrides={overrides}
            onChange={(key, value) =>
              setOverrides((current) => ({ ...current, [key]: value }))
            }
            onReset={() => {
              setOverrides((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(
                    ([key]) =>
                      key !== farKey && !key.startsWith(`${thresholdPrefix}.`),
                  ),
                ),
              );
              setValidation(null);
              setError("");
            }}
          />
        </fieldset>
        <fieldset
          className="wizard-panel"
          disabled={step !== 3}
          hidden={step !== 3}
        >
          <legend>Step 4: Review & confirm</legend>
          <p>
            Check your selections and validate the configuration before
            submitting.
          </p>
          <dl className="review-list">
            <div>
              <dt>Experiment</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Output location</dt>
              <dd className="result-path">
                {outputLocation}/&lt;experiment_name&gt;_&lt;timestamp&gt;/
              </dd>
            </div>
            <div>
              <dt>Compute</dt>
              <dd>
                {device === "cpu"
                  ? "CPU"
                  : props.gpus.find((gpu) => gpu.uuid === device)?.name ||
                    device}
              </dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>{config}</dd>
            </div>
            <div>
              <dt>Training data</dt>
              <dd>
                {datasetMode === "config"
                  ? "Config selection"
                  : `${sourcePaths("train").length} custom CSVs`}
              </dd>
            </div>
            <div>
              <dt>Validation data</dt>
              <dd>Automatic split</dd>
            </div>
            <div>
              <dt>Test data</dt>
              <dd>
                {datasetMode === "config"
                  ? `${sourcePaths("test").length} config CSVs`
                  : `${sourcePaths("test").length} custom CSVs`}
              </dd>
            </div>
            {effectiveEvaluation.thresholds.map(({ card, value }) => (
              <div key={card}>
                <dt>{card} tamper threshold</dt>
                <dd>{Number.isFinite(value) ? value : "Invalid"}</dd>
              </div>
            ))}
            <div>
              <dt>FAR constraint</dt>
              <dd>
                {Number.isFinite(effectiveEvaluation.far)
                  ? `${Number((effectiveEvaluation.far * 100).toPrecision(12))}%`
                  : "Invalid"}
              </dd>
            </div>
          </dl>
          <details className="inner-details">
            <summary>Changed configuration values</summary>
            <pre className="review-code">
              {Object.keys(overrides).length
                ? JSON.stringify(overrides, null, 2)
                : "Using template defaults"}
            </pre>
          </details>
          <button
            type="button"
            className="secondary"
            disabled={props.busy || !hasTrainingData || !name}
            onClick={() =>
              props.act(async () => {
                const datasetIds = await effectiveDatasetIds();
                setValidation(
                  await submit(
                    endpoints.training.validate,
                    body(datasetIds),
                    false,
                  ),
                );
              }, "Training preflight completed.")
            }
          >
            Validate configuration
          </button>
          {validation && (
            <Notice error={!validation.valid}>
              {validation.valid
                ? "Ready: " +
                  validation.split_counts.train +
                  " training, " +
                  validation.split_counts.val +
                  " validation, " +
                  validation.split_counts.test +
                  " test samples."
                : validation.errors.join(" · ")}
              {validation.warnings?.length > 0 && (
                <div>{validation.warnings.join(" ")}</div>
              )}
            </Notice>
          )}
        </fieldset>
        <Notice error>{error}</Notice>
        <div className="form-actions wizard-actions">
          {step > 0 && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setStep(step - 1);
                setError("");
              }}
            >
              ← Previous
            </button>
          )}
          <span>
            Step {step + 1} of {steps.length}
          </span>
          {step < 3 ? (
            <button className="primary" type="button" onClick={next}>
              Continue →
            </button>
          ) : (
            <BusyButton
              busy={props.busy}
              disabled={!hasTrainingData || validation?.valid === false}
            >
              Start training ↗
            </BusyButton>
          )}
        </div>
      </form>
    </Card>
  );
}
