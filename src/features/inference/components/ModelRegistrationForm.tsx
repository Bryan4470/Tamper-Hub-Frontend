import { type FormEvent, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { SavedCheckpoint, SavedCheckpointList } from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { BusyButton } from "@/components/ui/BusyButton";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";

export function ModelRegistrationForm(
  props: Pick<HubProps, "models" | "busy" | "act" | "revision"> & {
    onRegistered: (id: string) => void;
  },
) {
  const [modelName, setModelName] = useState(""),
    [remark, setRemark] = useState(""),
    [selectedRunId, setSelectedRunId] = useState(""),
    [checkpointPath, setCheckpointPath] = useState(""),
    [configPath, setConfigPath] = useState("");
  const [customName, setCustomName] = useState(false);
  const checkpoints = useRemote<SavedCheckpointList>(
    endpoints.studio.checkpoints,
    { items: [] },
    props.revision,
    60000,
  );
  const savedRuns = [
    ...new Map(
      checkpoints.data.items.map((checkpoint) => [
        checkpoint.run_id,
        checkpoint,
      ]),
    ).values(),
  ].sort((a, b) => {
    const timestamp = (name: string) => name.match(/(\d{8}_\d{6})$/)?.[1] || "";
    return (
      timestamp(b.run_name).localeCompare(timestamp(a.run_name)) ||
      b.run_name.localeCompare(a.run_name)
    );
  });
  const runCheckpoints = checkpoints.data.items.filter(
    (checkpoint) => checkpoint.run_id === selectedRunId,
  );

  function selectCheckpoint(checkpoint?: SavedCheckpoint) {
    if (!checkpoint) return;
    setCheckpointPath(checkpoint.checkpoint_path);
    setConfigPath(checkpoint.config_path);
    if (!customName)
      setModelName(`${checkpoint.run_name} · ${checkpoint.name}`);
  }

  function register(e: FormEvent) {
    e.preventDefault();
    props.act(async () => {
      const m = await submit(
        endpoints.models.create,
        {
          name: modelName,
          remark,
          checkpoint_path: checkpointPath,
          config_path: configPath,
        },
        false,
      );
      props.onRegistered(m.id);
    }, "Model registered.");
  }

  return (
    <details className="disclosure" open={!props.models.length}>
      <summary>
        Register a model checkpoint <span>{props.models.length} available</span>
      </summary>
      <form onSubmit={register}>
        <Notice error>{checkpoints.error}</Notice>
        <div className="form-grid">
          <Field label="Saved training run">
            <select
              value={selectedRunId}
              onChange={(e) => {
                setSelectedRunId(e.target.value);
                setCheckpointPath("");
                setConfigPath("");
                if (!customName) setModelName("");
              }}
            >
              <option value="">
                {checkpoints.loading
                  ? "Loading saved runs…"
                  : "Enter paths manually"}
              </option>
              {savedRuns.map((run) => (
                <option key={run.run_id} value={run.run_id}>
                  {run.run_name} · {run.run_kind}
                </option>
              ))}
            </select>
          </Field>
          {selectedRunId && (
            <Field label="Checkpoint">
              <select
                required
                value={checkpointPath}
                onChange={(e) =>
                  selectCheckpoint(
                    runCheckpoints.find(
                      (item) => item.checkpoint_path === e.target.value,
                    ),
                  )
                }
              >
                <option value="">Choose a checkpoint</option>
                {runCheckpoints.map((checkpoint) => (
                  <option
                    key={checkpoint.id}
                    value={checkpoint.checkpoint_path}
                  >
                    {checkpoint.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Model name">
            <input
              required
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                setCustomName(Boolean(e.target.value.trim()));
              }}
              placeholder="Candidate · epoch 47"
            />
          </Field>
          <Field label="Checkpoint path">
            <input
              required
              value={checkpointPath}
              onChange={(e) => setCheckpointPath(e.target.value)}
              placeholder="/path/to/epoch_47.pth"
            />
          </Field>
          <Field label="Model configuration path">
            <input
              required
              value={configPath}
              onChange={(e) => setConfigPath(e.target.value)}
              placeholder="/path/to/run/config.yaml"
            />
          </Field>
          <Field label="Remark">
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Purpose, review status, or deployment notes"
              maxLength={2000}
            />
          </Field>
        </div>
        <BusyButton busy={props.busy}>Register model</BusyButton>
      </form>
    </details>
  );
}
