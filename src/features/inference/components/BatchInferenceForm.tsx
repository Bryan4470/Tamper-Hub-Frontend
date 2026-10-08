import { type FormEvent, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { HubProps } from "@/app/types";
import { DeviceSelect } from "@/components/forms/DeviceSelect";
import { Picker } from "@/components/forms/Picker";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

export function BatchInferenceForm(
  props: Pick<HubProps, "models" | "datasets" | "gpus" | "busy" | "act"> & {
    onCreated: (id: string) => void;
    device: string;
    setDevice: (value: string) => void;
    crop: boolean;
    setCrop: (value: boolean) => void;
    selectedModels: string[];
    setSelectedModels: (ids: string[]) => void;
  },
) {
  const {
    device,
    setDevice,
    crop,
    setCrop,
    selectedModels,
    setSelectedModels,
  } = props;
  const [datasets, setDatasets] = useState<string[]>([]),
    [batch, setBatch] = useState(16),
    [name, setName] = useState("Benchmark inference");
  function start(e: FormEvent) {
    e.preventDefault();
    props.act(async () => {
      const r = await submit(endpoints.inference.create, {
        name,
        model_ids: selectedModels,
        dataset_ids: datasets,
        device,
        crop,
        batch_size: batch,
      });
      props.onCreated(r.resource_id);
    }, "Batch inference queued.");
  }

  return (
    <Card
      title="Batch inference"
      subtitle="Each selected checkpoint is evaluated against every selected dataset."
    >
      <form onSubmit={start}>
        <div className="section-label">
          <span className="section-number">1</span> Run settings
        </div>
        <div className="form-grid">
          <Field label="Run name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <DeviceSelect value={device} onChange={setDevice} gpus={props.gpus} />
        </div>
        <div className="section-label">
          <span className="section-number">2</span> Models & datasets
        </div>
        <div className="two-columns">
          <Picker
            label="Model checkpoints"
            items={props.models}
            selected={selectedModels}
            onChange={setSelectedModels}
          />
          <Picker
            label="Input datasets"
            items={props.datasets}
            selected={datasets}
            onChange={setDatasets}
          />
        </div>
        <div className="form-grid">
          <Field label="Batch size">
            <input
              type="number"
              min="1"
              max="1024"
              value={batch}
              onChange={(e) => setBatch(Number(e.target.value))}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={crop}
              onChange={(e) => setCrop(e.target.checked)}
            />
            Crop original images before inference
          </label>
        </div>
        <p className="muted">
          Predictions use each checkpoint's configured front/back thresholds.
          You can rescore them later without rerunning the model.
        </p>
        <div className="form-actions">
          <span>
            {selectedModels.length * datasets.length} model × dataset
            combinations
          </span>
          <BusyButton
            busy={props.busy}
            disabled={!selectedModels.length || !datasets.length}
          >
            Run batch inference ↗
          </BusyButton>
        </div>
      </form>
    </Card>
  );
}
