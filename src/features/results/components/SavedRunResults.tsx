import { useId, useState } from "react";
import { endpoints } from "@/api/endpoints";
import type { SavedRunDetail } from "@/api/studioTypes";
import type { HubProps } from "@/app/types";
import { Chart } from "@/components/data-display/Chart";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { EpochDetails } from "@/features/results/components/EpochDetails";
import { DatasetDistribution } from "@/features/results/components/DatasetDistribution";
import { SavedArtifactTable } from "@/features/results/components/SavedArtifactTable";
import { InferenceReport } from "@/features/inference/components/InferenceReport";
import { useRemote } from "@/hooks/useRemote";

export function SavedRunResults({
  selected,
  go,
  revision,
  act,
}: Pick<HubProps, "revision" | "act" | "go"> & { selected: string }) {
  const detail = useRemote<SavedRunDetail | null>(
    endpoints.studio.detail(selected),
    null,
    revision,
    30000,
  );
  const [tab, setTab] = useState("Results");
  const tabId = useId();
  const tabs = ["Results", "Dataset distribution", "Epoch details"];
  const [split, setSplit] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const data = detail.data;
  const splits = [
    ...new Set(data?.artifacts.map((artifact) => artifact.split) || []),
  ];
  const activeSplit = splits.includes(split as (typeof splits)[number])
    ? split
    : splits.includes("validation")
      ? "validation"
      : splits[0];
  const artifacts =
    data?.artifacts.filter((artifact) => artifact.split === activeSplit) || [];
  const artifact =
    artifacts.find((item) => item.id === artifactId) || artifacts[0];
  if (data?.run.kind === "inference")
    return (
      <Card title={data.run.name}>
        <InferenceReport
          go={go}
          source={{ path: data.run.directory }}
          act={act}
          revision={revision}
        />
      </Card>
    );
  return (
    <Card title={data?.run.name || "Saved run details"}>
      <Notice error>{detail.error}</Notice>
      {detail.loading && <p role="status">Reading saved run…</p>}
      {data && (
        <>
          <div className="detail-summary">
            <Status value={data.run.status} />
            <span>{data.run.kind} results</span>
          </div>
          <p className="result-path">{data.run.directory}</p>
          <Notice error>{data.run.error}</Notice>
          {data.warnings.map((warning) => (
            <Notice error key={warning}>
              {warning}
            </Notice>
          ))}
          <div
            className="report-tabs"
            role="tablist"
            aria-label="Training run sections"
          >
            {tabs.map((name, index) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`${tabId}-${index}`}
                aria-controls={`${tabId}-panel`}
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : -1;
                  if (next >= 0) {
                    event.preventDefault();
                    setTab(tabs[next]);
                    document.getElementById(`${tabId}-${next}`)?.focus();
                  }
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-${tabs.indexOf(tab)}`}
          >
            {tab === "Dataset distribution" ? (
              <DatasetDistribution runId={selected} revision={revision} />
            ) : tab === "Epoch details" ? (
              <EpochDetails
                key={selected}
                runId={selected}
                revision={revision}
                initialSplit={activeSplit === "test" ? "test" : "validation"}
              />
            ) : (
              <>
                {(data.run.kind === "training" ||
                  data.run.kind === "training-legacy") && (
                  <Chart
                    rows={data.history}
                    xKey="epoch"
                    title="Saved training and validation loss"
                    lines={[
                      {
                        key: "train_loss",
                        label: "Training",
                        color: "#23836c",
                      },
                      {
                        key: "val_loss",
                        label: "Validation",
                        color: "#d78342",
                      },
                    ]}
                  />
                )}
                {artifacts.length ? (
                  <>
                    <div className="results-filters">
                      <Field label="Result split">
                        <select
                          value={activeSplit}
                          onChange={(e) => {
                            setSplit(e.target.value);
                            setArtifactId("");
                          }}
                        >
                          {splits.map((value) => (
                            <option key={value} value={value}>
                              {value === "validation"
                                ? "Validation"
                                : value === "test"
                                  ? "Test"
                                  : value === "training"
                                    ? "Training history"
                                    : "Inference"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Saved artifact">
                        <select
                          value={artifact?.id || ""}
                          onChange={(e) => setArtifactId(e.target.value)}
                        >
                          {artifacts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {artifact && (
                      <SavedArtifactTable
                        go={go}
                        key={artifact.id}
                        runId={selected}
                        artifact={artifact}
                        revision={revision}
                        act={act}
                      />
                    )}
                  </>
                ) : (
                  <Empty title="No result files yet">
                    This folder does not contain readable metrics or
                    predictions.
                  </Empty>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
