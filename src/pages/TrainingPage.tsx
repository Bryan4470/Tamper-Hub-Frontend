import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { runColumns } from "@/components/data-display/runColumns";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Notice } from "@/components/ui/Notice";
import { TrainingForm } from "@/features/training/components/TrainingForm";
import { TrainingImportForm } from "@/features/training/components/TrainingImportForm";
import { TrainingRunDetails } from "@/features/training/components/TrainingRunDetails";
import { useRemote } from "@/hooks/useRemote";

export function TrainingPage(props: HubProps) {
  const [selected, setSelected] = useState(props.target);
  const runs = useRemote<Page>(
    endpoints.training.list(100),
    emptyPage,
    props.revision,
  );

  return (
    <>
      <p className="muted">
        Looking for previous Studio runs?{" "}
        <button className="text-button" onClick={() => props.go("results")}>
          Browse saved results →
        </button>
      </p>
      <div className="workspace-grid training-workspace">
        <div>
          <TrainingForm {...props} onCreated={setSelected} />
          <TrainingImportForm {...props} onImported={setSelected} />
        </div>
        <div>
          <Card
            title="Training runs"
            subtitle="Select an experiment to inspect its metrics and checkpoints."
          >
            <Notice error>{runs.error}</Notice>
            {runs.data.items.length ? (
              <Table
                rows={runs.data.items}
                columns={runColumns}
                selected={selected}
                onRow={(r) => setSelected(r.id)}
              />
            ) : (
              <Empty title="No training runs yet">
                Start an experiment or import a previous run.
              </Empty>
            )}
          </Card>
          {selected && <TrainingRunDetails {...props} selected={selected} />}
        </div>
      </div>
    </>
  );
}
