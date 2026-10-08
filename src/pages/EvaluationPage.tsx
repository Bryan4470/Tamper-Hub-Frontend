import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Status } from "@/components/ui/Status";
import { EvaluationForm } from "@/features/evaluation/components/EvaluationForm";
import { EvaluationResults } from "@/features/evaluation/components/EvaluationResults";
import { useRemote } from "@/hooks/useRemote";
import { number, pct } from "@/utils/format";

export function EvaluationPage(props: HubProps) {
  const [selected, setSelected] = useState(
    props.target.startsWith("evaluation_") ? props.target : "",
  );
  const evaluations = useRemote<Page>(
    endpoints.evaluations.list(100),
    emptyPage,
    props.revision,
  );

  return (
    <div className="workspace-grid evaluation-workspace">
      <div>
        <EvaluationForm {...props} onCreated={setSelected} />
      </div>
      <div>
        <Card title="Saved evaluations">
          {evaluations.data.items.length ? (
            <Table
              rows={evaluations.data.items}
              selected={selected}
              onRow={(r) => setSelected(r.id)}
              columns={[
                { key: "name", label: "Evaluation" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Status value={r.status} />,
                },
                {
                  key: "far",
                  label: "FAR",
                  render: (r) => pct(r.result?.metrics?.far),
                },
                {
                  key: "frr",
                  label: "FRR",
                  render: (r) => pct(r.result?.metrics?.frr),
                },
                {
                  key: "samples",
                  label: "Scored samples",
                  render: (r) => number(r.result?.metrics?.num_samples),
                },
              ]}
            />
          ) : (
            <Empty title="No evaluations yet">
              Generate or import predictions, then evaluate them here.
            </Empty>
          )}
        </Card>
        {selected && <EvaluationResults {...props} selected={selected} />}
      </div>
    </div>
  );
}
