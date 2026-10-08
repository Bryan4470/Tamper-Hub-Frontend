import { type FormEvent, useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { ModelRegistrationForm } from "@/features/inference/components/ModelRegistrationForm";
export function ModelsPage(props: HubProps) {
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editRemark, setEditRemark] = useState("");

  function beginEdit(model: Row) {
    setEditing(model);
    setEditName(model.name || "");
    setEditRemark(model.remark || "");
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    void props.act(async () => {
      await api(endpoints.models.detail(editing.id), {
        method: "PATCH",
        body: JSON.stringify({ name: editName, remark: editRemark }),
      });
      setEditing(null);
    }, "Model details updated.");
  }

  function remove(model: Row) {
    if (
      !window.confirm(
        `Remove “${model.name}” from the registry? The checkpoint file will not be deleted.`,
      )
    )
      return;
    void props.act(async () => {
      await api(endpoints.models.detail(model.id), { method: "DELETE" });
      if (selected === model.id) setSelected("");
      if (editing?.id === model.id) setEditing(null);
    }, "Model removed from the registry. The checkpoint file was not deleted.");
  }

  return (
    <div className="workspace-grid models-workspace">
      <div>
        <Card
          title="Add a model"
          subtitle="Register a checkpoint with the configuration used to train it."
        >
          <p>
            Registered models are available to batch inference, single-image
            prediction, and evaluation.
          </p>
        </Card>
        <ModelRegistrationForm {...props} onRegistered={setSelected} />
      </div>
      <Card
        title="Registered checkpoints"
        subtitle="Choose a model to start an inference run."
      >
        {props.models.length ? (
          <Table
            rows={props.models}
            selected={selected}
            onRow={(model) => {
              setSelected(model.id);
              props.go("inference", model.id);
            }}
            columns={[
              { key: "name", label: "Model" },
              {
                key: "checkpoint_path",
                label: "Checkpoint",
                render: (model) => (
                  <span className="result-cell" title={model.checkpoint_path}>
                    {model.checkpoint_path || "Registered checkpoint"}
                  </span>
                ),
              },
              {
                key: "remark",
                label: "Remark",
                render: (model) => model.remark || "—",
              },
              {
                key: "created_at",
                label: "Saved",
                render: (model) =>
                  model.created_at
                    ? new Date(model.created_at).toLocaleString()
                    : "—",
              },
              {
                key: "actions",
                label: "Actions",
                render: (model) => (
                  <div className="button-group">
                    <button
                      className="secondary small"
                      onClick={(event) => {
                        event.stopPropagation();
                        beginEdit(model);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="danger-button small"
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(model);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Empty title="No model checkpoints yet">
            Register a trained checkpoint to make it available for inference.
          </Empty>
        )}
        {editing && (
          <form onSubmit={saveEdit}>
            <h3>Edit registered model</h3>
            <div className="form-grid">
              <Field label="Model name">
                <input
                  required
                  maxLength={120}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </Field>
              <Field label="Remark">
                <textarea
                  maxLength={2000}
                  value={editRemark}
                  onChange={(event) => setEditRemark(event.target.value)}
                />
              </Field>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <BusyButton busy={props.busy}>Save changes</BusyButton>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
