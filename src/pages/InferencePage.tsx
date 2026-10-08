import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { inferenceRunColumns } from "@/features/inference/components/inferenceRunColumns";
import { describeRun } from "@/features/inference/utils/runDescription";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { BatchInferenceForm } from "@/features/inference/components/BatchInferenceForm";
import { DirectInferenceForm } from "@/features/inference/components/DirectInferenceForm";
import { InferenceRunDetails } from "@/features/inference/components/InferenceRunDetails";
import { useRemote } from "@/hooks/useRemote";

export function InferencePage(props: HubProps) {
  const [selected, setSelected] = useState(
      props.target.startsWith("inference_") ? props.target : "",
    ),
    [selectedModels, setSelectedModels] = useState<string[]>(
      props.target.startsWith("model_") ? [props.target] : [],
    );
  const [device, setDevice] = useState("cpu"),
    [crop, setCrop] = useState(false);
  const runs = useRemote<Page>(
    endpoints.inference.list(100),
    emptyPage,
    props.revision,
  );

  return (
    <div>
      {selected && (
        <>
          <div className="form-actions">
            <button className="secondary" onClick={() => setSelected("")}>
              ← Back to inference runs
            </button>
          </div>
          <InferenceRunDetails {...props} key={selected} selected={selected} />
        </>
      )}
      <div hidden={Boolean(selected)}>
        <DirectInferenceForm
          {...props}
          initialModel={props.target.startsWith("model_") ? props.target : ""}
          onCreated={setSelected}
        />
        <Card title="Inference runs" className="inference-run-list">
          {runs.data.items.length ? (
            <Table
              rows={runs.data.items.map((run) => ({
                ...run,
                display: describeRun(run, props.models, props.datasets),
              }))}
              columns={inferenceRunColumns}
              selected={selected}
              onRow={(r) => {
                setSelected(r.id);
              }}
            />
          ) : (
            <Empty title="No inference runs yet">
              Choose a checkpoint and input above to generate predictions.
            </Empty>
          )}
        </Card>
        <details className="inner-details">
          <summary>Registered datasets</summary>
          <div className="inference-workspace">
            <div>
              <BatchInferenceForm
                {...props}
                device={device}
                setDevice={setDevice}
                crop={crop}
                setCrop={setCrop}
                selectedModels={selectedModels}
                setSelectedModels={setSelectedModels}
                onCreated={setSelected}
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
