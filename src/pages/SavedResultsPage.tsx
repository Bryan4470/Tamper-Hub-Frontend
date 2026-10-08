import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import type { SavedRunList } from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { InferenceReport } from "@/features/inference/components/InferenceReport";
import { SavedRunResults } from "@/features/results/components/SavedRunResults";
import { useRemote } from "@/hooks/useRemote";

export function SavedResultsPage(
  props: Pick<HubProps, "revision" | "act" | "go">,
) {
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [refresh, setRefresh] = useState(0);
  const runs = useRemote<SavedRunList>(
    endpoints.studio.list,
    { items: [], roots: [], warnings: [] },
    props.revision + refresh,
    60000,
  );
  const reports = useRemote<SavedRunList>(
    endpoints.inferenceReport.saved,
    { items: [], roots: [], warnings: [] },
    props.revision + refresh,
    60000,
  );
  const allRuns = [
    ...new Map(
      [...runs.data.items, ...reports.data.items].map((run) => [
        run.directory,
        run,
      ]),
    ).values(),
  ].sort((a, b) => b.modified.localeCompare(a.modified));
  const roots = [
    ...new Set([...runs.data.roots, ...(reports.data.roots || [])]),
  ];
  const warnings = [...runs.data.warnings, ...(reports.data.warnings || [])];
  const selectedRun = allRuns.find((run) => run.id === selected);
  const filtered = allRuns.filter(
    (run) =>
      (!kind || run.kind === kind) &&
      `${run.name} ${run.directory}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="saved-results-workspace">
      <Card
        title="Saved Studio runs"
        subtitle="Browse existing training and inference results. Select a run to inspect its saved data."
        action={
          <button
            className="secondary"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Refresh saved results
          </button>
        }
      >
        <Notice error>{runs.error}</Notice>
        <Notice error>{reports.error}</Notice>
        {warnings.length > 0 && (
          <details className="inner-details">
            <summary>
              Some result folders could not be read ({warnings.length})
            </summary>
            {warnings.map((warning) => (
              <Notice error key={warning}>
                {warning}
              </Notice>
            ))}
          </details>
        )}
        <div className="results-filters">
          <Field label="Search saved runs">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Run name or folder"
            />
          </Field>
          <Field label="Run type">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All runs</option>
              <option value="training">Training</option>
              <option value="training-legacy">Training (legacy)</option>
              <option value="inference">Inference</option>
            </select>
          </Field>
        </div>
        <p className="muted">
          {filtered.length} of {allRuns.length} saved runs
        </p>
        {runs.loading ? (
          <p role="status">Reading saved runs…</p>
        ) : filtered.length ? (
          <div className="saved-run-list">
            <Table
              rows={filtered}
              selected={selected}
              onRow={(run) => setSelected(run.id)}
              columns={[
                {
                  key: "name",
                  label: "Run",
                  render: (run) => (
                    <span className="result-run-name">
                      {run.name}
                      <small className="subcell">
                        {run.kind} ·{" "}
                        {new Date(run.modified).toLocaleDateString()}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (run) => <Status value={run.status} />,
                },
              ]}
            />
          </div>
        ) : (
          !runs.error && (
            <Empty
              title={
                allRuns.length ? "No matching runs" : "No saved results found"
              }
            >
              Training Studio runs appear here when their result folders are
              available on this host.
            </Empty>
          )
        )}
        {roots.length > 0 && (
          <details className="inner-details">
            <summary>Result locations</summary>
            {roots.map((root) => (
              <p className="result-path" key={root}>
                {root}
              </p>
            ))}
          </details>
        )}
      </Card>
      <div className="saved-results-detail">
        {selectedRun?.inference_id ? (
          <Card title={selectedRun.name}>
            <InferenceReport
              go={props.go}
              source={{ runId: selectedRun.inference_id }}
              act={props.act}
              revision={props.revision + refresh}
            />
          </Card>
        ) : selected ? (
          <SavedRunResults
            go={props.go}
            key={selected}
            selected={selected}
            revision={props.revision + refresh}
            act={props.act}
          />
        ) : (
          <Card title="Run results">
            <Empty title="Select a saved run">
              Choose a training or inference run to explore its metrics, charts,
              and prediction files.
            </Empty>
          </Card>
        )}
      </div>
    </div>
  );
}
