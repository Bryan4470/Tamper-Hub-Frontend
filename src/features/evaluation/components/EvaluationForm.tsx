import { type FormEvent, useEffect, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Picker } from "@/components/forms/Picker";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { HelpHint } from "@/components/ui/HelpHint";
import { PredictionImportForm } from "@/features/evaluation/components/PredictionImportForm";
import { ThresholdSweepResults } from "@/features/evaluation/components/ThresholdSweepResults";
import { useRemote } from "@/hooks/useRemote";

export function EvaluationForm(
  props: Pick<
    HubProps,
    "datasets" | "models" | "revision" | "busy" | "act" | "target"
  > & { onCreated: (id: string) => void },
) {
  const artifacts = useRemote<Page>(
    endpoints.artifacts.list(1000),
    emptyPage,
    props.revision,
    10000,
  );

  const [model, setModel] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [gt, setGt] = useState<string[]>([]);
  const [front, setFront] = useState(0.5),
    [back, setBack] = useState(0.5),
    [far, setFar] = useState(0.002),
    [name, setName] = useState("Benchmark evaluation");

  const [sweepId, setSweepId] = useState(
    props.target.startsWith("sweep_") ? props.target : "",
  );
  const predictions = artifacts.data.items.filter(
    (a) => a.kind === "predictions",
  );
  const selectedModel = model || props.models[0]?.id || "";
  const available = predictions
    .filter((a) => a.model_id === selectedModel)
    .map((a) => ({
      ...a,
      name: `${props.datasets.find((d) => d.id === a.dataset_id)?.name || "Prediction"} · ${a.filename.slice(0, 12)}`,
    }));
  useEffect(() => {
    if (!props.target.startsWith("artifact_") || !predictions.length) return;
    const requested = props.target.split(",");
    const first = predictions.find((a) => requested.includes(a.id));
    if (first) {
      setModel(first.model_id);
      setIds(
        predictions
          .filter(
            (a) => a.model_id === first.model_id && requested.includes(a.id),
          )
          .map((a) => a.id),
      );
    }
  }, [props.target, artifacts.data.items.length]);
  function chooseModel(id: string) {
    setModel(id);
    setIds([]);
    const thresholds = props.models.find((m) => m.id === id)?.thresholds || {};
    setFront(thresholds.mykadfront ?? 0.5);
    setBack(thresholds.mykadback ?? thresholds.mykadfront ?? 0.5);
  }
  function start(e: FormEvent) {
    e.preventDefault();
    props.act(async () => {
      const saved = await submit(endpoints.evaluations.create, {
        name,
        prediction_artifact_ids: ids,
        ground_truth_dataset_ids: gt,
        thresholds: { mykadfront: front, mykadback: back },
      });
      props.onCreated(saved.resource_id);
    }, "Evaluation queued on the CPU worker.");
  }
  function tune() {
    props.act(async () => {
      const saved = await submit(endpoints.sweeps.create, {
        name: `${name} · threshold sweep`,
        prediction_artifact_ids: ids,
        ground_truth_dataset_ids: gt,
        far_limit: far,
      });
      setSweepId(saved.resource_id);
    }, "Threshold sweep queued.");
  }

  return (
    <>
      <Card
        title="Score saved predictions"
        subtitle="Select predictions for one model. Evaluation reuses its scores without GPU inference."
        action={
          <HelpHint title="When to use evaluation">
            <p>
              Inference on labeled images can already report accuracy, FAR, and
              FRR. If your inference report includes these metrics, you do not
              need to run evaluation again just to see them.
            </p>
            <p>
              Use this page to recalculate metrics from saved predictions with
              different thresholds or ground-truth labels. It compares scores
              with known genuine/tampered labels without running the model
              again.
            </p>
          </HelpHint>
        }
      >
        <form onSubmit={start}>
          <div className="form-grid">
            <Field label="Evaluation name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Model checkpoint">
              <select
                value={selectedModel}
                onChange={(e) => chooseModel(e.target.value)}
              >
                {props.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Picker
            label="Prediction artifacts"
            items={available}
            selected={ids}
            onChange={setIds}
          />
          <div className="form-grid three">
            <Field label="MyKad front threshold">
              <input
                type="number"
                min="0"
                max="1"
                step="any"
                required
                value={front}
                onChange={(e) => setFront(Number(e.target.value))}
              />
            </Field>
            <Field label="MyKad back threshold">
              <input
                type="number"
                min="0"
                max="1"
                step="any"
                required
                value={back}
                onChange={(e) => setBack(Number(e.target.value))}
              />
            </Field>
            <Field
              label="FAR limit for threshold tuning"
              hint="0.002 means 0.2% false acceptance."
            >
              <input
                type="number"
                min="0"
                max="1"
                step="any"
                required
                value={far}
                onChange={(e) => setFar(Number(e.target.value))}
              />
            </Field>
          </div>
          <details className="inner-details">
            <summary>Override ground truth (optional)</summary>
            <Picker
              label="Ground-truth datasets"
              items={props.datasets}
              selected={gt}
              onChange={setGt}
            />
            <p className="muted">
              Leave empty to use labels captured during inference. Unmatched
              samples remain unlabeled when an override is selected.
            </p>
          </details>
          <div className="form-actions">
            <div className="evaluation-tuning-action">
              <button
                className="secondary"
                type="button"
                disabled={props.busy || !ids.length}
                onClick={tune}
              >
                Tune thresholds
              </button>
              <HelpHint title="What threshold tuning does">
                <p>
                  A threshold is the cutoff for calling an image tampered. A
                  score of 0.65 is tampered at a 0.50 threshold, but genuine at
                  0.80.
                </p>
                <p>
                  Tuning tries cutoffs on saved, labeled predictions without
                  running inference again. It recommends a threshold per card
                  type that minimizes genuine cards rejected (FRR) while keeping
                  tampered cards accepted (FAR) within your chosen limit.
                </p>
                <p>
                  Tune on validation data, then evaluate the chosen thresholds
                  on a separate test dataset. Applying a recommendation fills
                  this evaluation form; it does not change the model or its
                  defaults.
                </p>
              </HelpHint>
            </div>
            <BusyButton busy={props.busy} disabled={!ids.length}>
              Run evaluation ↗
            </BusyButton>
          </div>
          <p className="muted">
            Tune on calibration or validation data, then evaluate the frozen
            thresholds on a held-out benchmark.
          </p>
        </form>
      </Card>
      <PredictionImportForm
        {...props}
        selectedModel={selectedModel}
        onImported={(id) => setIds([id])}
      />
      <ThresholdSweepResults
        revision={props.revision}
        sweepId={sweepId}
        onSelect={setSweepId}
        onApply={(card, value) =>
          card === "mykadfront" ? setFront(value) : setBack(value)
        }
      />
    </>
  );
}
