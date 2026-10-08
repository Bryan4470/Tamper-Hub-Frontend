import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Status } from "@/components/ui/Status";
import { ComparisonForm } from "@/features/comparison/components/ComparisonForm";
import { ComparisonResults } from "@/features/comparison/components/ComparisonResults";
import { CheckpointComparison } from "@/features/comparison/components/CheckpointComparison";
import { useRemote } from "@/hooks/useRemote";
import { number } from "@/utils/format";

export function ComparisonPage(props: HubProps) {
  const [selected, setSelected] = useState(props.target);
  const comparisons = useRemote<Page>(
    endpoints.comparisons.list(100),
    emptyPage,
    props.revision,
  );

  return (
    <>
      <CheckpointComparison revision={props.revision} />
      <div className="workspace-grid comparison-workspace">
        <div>
          <ComparisonForm {...props} onCreated={setSelected} />
        </div>
        <div>
          <Card title="Saved comparisons">
            {comparisons.data.items.length ? (
              <Table
                rows={comparisons.data.items}
                selected={selected}
                onRow={(r) => setSelected(r.id)}
                columns={[
                  { key: "name", label: "Comparison" },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => <Status value={r.status} />,
                  },
                  {
                    key: "compatible",
                    label: "Evidence",
                    render: (r) =>
                      r.result
                        ? r.result.comparable
                          ? "Comparable"
                          : "Review mismatches"
                        : "Pending",
                  },
                  {
                    key: "common",
                    label: "Common samples",
                    render: (r) => number(r.result?.common_samples),
                  },
                ]}
              />
            ) : (
              <Empty title="Choose your first baseline">
                Complete two evaluations to compare their results here.
              </Empty>
            )}
          </Card>
          {selected && <ComparisonResults {...props} selected={selected} />}
        </div>
      </div>
    </>
  );
}
