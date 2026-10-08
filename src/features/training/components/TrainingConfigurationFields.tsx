import type { Row } from "@/api/types";
import { Field } from "@/components/ui/Field";

export function TrainingConfigurationFields({
  template,
  overrides,
  onChange,
}: {
  template: Row;
  overrides: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  function configured(path: string, fallback: unknown) {
    if (path in overrides) return overrides[path];
    return (
      path.split(".").reduce<unknown>((value, key) => {
        if (value && typeof value === "object") return (value as Row)[key];
        return undefined;
      }, template.config) ?? fallback
    );
  }

  const numeric = (key: string, fallback: number) =>
    Number(configured(key, fallback));
  const checked = (key: string, fallback: boolean) =>
    Boolean(configured(key, fallback));

  return (
    <div className="configuration-groups">
      <section className="settings-group">
        <h3>Basics</h3>
        <p>How long to train and which model starting point to use.</p>
        <div className="settings-grid">
          <Field
            label="Epochs"
            hint="Complete passes through the training data."
          >
            <input
              type="number"
              min="1"
              value={numeric("training.epochs", 20)}
              onChange={(event) =>
                onChange("training.epochs", Number(event.target.value))
              }
            />
          </Field>
          <Field label="Image size" hint="Higher values use more GPU memory.">
            <select
              value={numeric("data.image_size", 512)}
              onChange={(event) =>
                onChange("data.image_size", Number(event.target.value))
              }
            >
              {[256, 512, 768, 1024].map((size) => (
                <option key={size} value={size}>
                  {size} × {size}
                </option>
              ))}
            </select>
          </Field>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={checked("model.pretrained", true)}
              onChange={(event) =>
                onChange("model.pretrained", event.target.checked)
              }
            />
            <span>
              <strong>Use pretrained model</strong>
              <small>Start from general image features.</small>
            </span>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={checked("augmentation.enabled", true)}
              onChange={(event) =>
                onChange("augmentation.enabled", event.target.checked)
              }
            />
            <span>
              <strong>Data augmentation</strong>
              <small>Vary training images to improve robustness.</small>
            </span>
          </label>
        </div>
      </section>
      <section className="settings-group">
        <h3>Data loading</h3>
        <p>Balance GPU memory use and input throughput.</p>
        <div className="settings-grid">
          <Field label="Batch size" hint="Images processed together per step.">
            <input
              type="number"
              min="1"
              value={numeric("data.batch_size", 16)}
              onChange={(event) =>
                onChange("data.batch_size", Number(event.target.value))
              }
            />
          </Field>
          <Field label="Data workers" hint="Parallel processes loading images.">
            <input
              type="number"
              min="0"
              value={numeric("data.num_workers", 4)}
              onChange={(event) =>
                onChange("data.num_workers", Number(event.target.value))
              }
            />
          </Field>
          <Field
            label="Validation split"
            hint="Share of training data reserved for validation."
          >
            <input
              type="number"
              min="0.01"
              max="0.99"
              step="0.01"
              value={numeric("data.val_split", 0.2)}
              onChange={(event) =>
                onChange("data.val_split", Number(event.target.value))
              }
            />
          </Field>
          <Field
            label="Gradient accumulation"
            hint="Combine steps before updating model weights."
          >
            <input
              type="number"
              min="1"
              value={numeric("training.gradient_accumulation_steps", 1)}
              onChange={(event) =>
                onChange(
                  "training.gradient_accumulation_steps",
                  Number(event.target.value),
                )
              }
            />
          </Field>
        </div>
      </section>
      <section className="settings-group">
        <h3>Optimization</h3>
        <p>Control how quickly the model updates.</p>
        <div className="settings-grid">
          <Field
            label="Learning rate"
            hint="Smaller values make more cautious updates."
          >
            <input
              type="number"
              min="0.000001"
              step="0.00001"
              value={numeric("training.learning_rate", 0.0003)}
              onChange={(event) =>
                onChange("training.learning_rate", Number(event.target.value))
              }
            />
          </Field>
          <Field label="Optimizer">
            <select
              value={String(configured("training.optimizer", "adamw"))}
              onChange={(event) =>
                onChange("training.optimizer", event.target.value)
              }
            >
              <option value="adamw">AdamW</option>
              <option value="adam">Adam</option>
              <option value="sgd">SGD</option>
            </select>
          </Field>
        </div>
      </section>
      <section className="settings-group">
        <h3>Training behavior</h3>
        <div className="settings-grid">
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={checked("training.early_stopping.enabled", true)}
              onChange={(event) =>
                onChange(
                  "training.early_stopping.enabled",
                  event.target.checked,
                )
              }
            />
            <span>
              <strong>Early stopping</strong>
              <small>Stop when validation stops improving.</small>
            </span>
          </label>
          <Field label="Patience" hint="Epochs to wait before stopping.">
            <input
              type="number"
              min="1"
              disabled={!checked("training.early_stopping.enabled", true)}
              value={numeric("training.early_stopping.patience", 10)}
              onChange={(event) =>
                onChange(
                  "training.early_stopping.patience",
                  Number(event.target.value),
                )
              }
            />
          </Field>
        </div>
      </section>
      <details className="inner-details advanced-settings-note">
        <summary>Advanced settings</summary>
        <p>
          Region definitions, loss weights, augmentation details, thresholds,
          checkpointing, and other advanced values remain unchanged from the
          selected template.
        </p>
      </details>
    </div>
  );
}
