import type { ReportSource } from "@/api/inferenceReportTypes";

function reportQuery(source: ReportSource) {
  const query = new URLSearchParams();
  if (source.runId) query.set("run_id", source.runId);
  if (source.path) query.set("path", source.path);
  if (source.artifactId) query.set("artifact_id", source.artifactId);
  return query;
}

// All paths are relative to the configured /api/v1 base URL.
// Keep backend route names and pagination defaults here.
const resource = (collection: string) => ({
  create: collection,
  list: (limit = 100) => `${collection}?limit=${limit}`,
  detail: (id: string) => `${collection}/${encodeURIComponent(id)}`,
});

export const endpoints = {
  notebook: "/studio-api/v1/notebook",
  notebookItems: {
    job: (id: string, jobId: string) =>
      `/studio-api/v1/notebook/items/${encodeURIComponent(id)}/jobs/${encodeURIComponent(jobId)}`,
    list: "/studio-api/v1/notebook/items",
    item: (id: string) =>
      `/studio-api/v1/notebook/items/${encodeURIComponent(id)}`,
    upload: (id: string, name: string) =>
      `/studio-api/v1/notebook/items/${encodeURIComponent(id)}/attachments?${new URLSearchParams({ name })}`,
    attachment: (id: string, fileId: string) =>
      `/studio-api/v1/notebook/items/${encodeURIComponent(id)}/attachments/${encodeURIComponent(fileId)}`,
  },
  gradcam: {
    ...resource("/gradcam-runs"),
    upload: "/gradcam-runs/upload",
    uploads: "/gradcam-runs/uploads",
  },
  inferenceReport: {
    saved: "/inference-report/saved",
    options: "/inference-report/options",
    detail: (source: ReportSource) =>
      `/inference-report?${reportQuery(source)}`,
    rows: (
      source: ReportSource,
      offset: number,
      outcome: string,
      search: string,
    ) =>
      `/inference-report/rows?${reportQuery(source)}&${new URLSearchParams({ offset: String(offset), limit: "24", outcome, q: search })}`,
    image: (source: ReportSource, index: number) =>
      `/inference-report/image?${reportQuery(source)}&index=${index}`,
    file: (source: ReportSource, name: string) =>
      `/inference-report/file?${reportQuery(source)}&${new URLSearchParams({ name })}`,
    archive: (source: ReportSource) =>
      `/inference-report/archive?${reportQuery(source)}`,
  },
  studio: {
    list: "/studio-api/v1/runs",
    checkpoints: "/studio-api/v1/checkpoints",
    detail: (id: string) => `/studio-api/v1/runs/${encodeURIComponent(id)}`,
    epochs: (id: string) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/epochs`,
    performance: (id: string, artifact: string) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/performance?${new URLSearchParams({ artifact })}`,
    distribution: (id: string) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/distribution`,
    table: (
      id: string,
      artifact: string,
      offset: number,
      search = "",
      outcome = "",
      cardType = "",
    ) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/table?${new URLSearchParams({ artifact, offset: String(offset), limit: "50", q: search, outcome, card_type: cardType })}`,
    csvImages: (
      id: string,
      artifact: string,
      source: string,
      cell: string,
      offset: number,
    ) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/table?${new URLSearchParams({ artifact, source_csv: source, confusion: cell, offset: String(offset), limit: "12" })}`,
    predictionImage: (id: string, artifact: string, index: number) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/image?${new URLSearchParams({ artifact, index: String(index) })}`,
    download: (id: string, artifact: string) =>
      `/studio-api/v1/runs/${encodeURIComponent(id)}/download?${new URLSearchParams({ artifact })}`,
  },
  system: { health: "/health", gpus: "/system/gpus" },
  datasets: {
    ...resource("/datasets"),
    preview: (id: string, offset = 0, limit = 12) =>
      `/datasets/${encodeURIComponent(id)}/preview?limit=${limit}&offset=${offset}`,
    validate: (id: string) => `/datasets/${encodeURIComponent(id)}/validate`,
  },
  datasetSources: "/dataset-sources",
  datasetCollections: "/dataset-collections",
  models: {
    ...resource("/models"),
    jobs: (id: string) => `/models/${encodeURIComponent(id)}/jobs`,
    job: (id: string, jobId: string) =>
      `/models/${encodeURIComponent(id)}/jobs/${encodeURIComponent(jobId)}`,
  },
  training: {
    ...resource("/training-runs"),
    overview: (path: string) =>
      `/training-overview?${new URLSearchParams({ path })}`,
    configs: "/training/configs",
    validate: "/training/validate",
    import: "/training-runs/import",
    metrics: (id: string) => `/training-runs/${encodeURIComponent(id)}/metrics`,
    checkpoints: (id: string) =>
      `/training-runs/${encodeURIComponent(id)}/checkpoints`,
  },
  inference: {
    ...resource("/inference-runs"),
    direct: "/inference-runs/direct",
    upload: "/inference-runs/upload",
    defaults: (model: {
      model_id?: string;
      checkpoint_path?: string;
      config_path?: string | null;
    }) => {
      const params = new URLSearchParams();
      if (model.model_id) params.set("model_id", model.model_id);
      if (model.checkpoint_path)
        params.set("checkpoint_path", model.checkpoint_path);
      if (model.config_path) params.set("config_path", model.config_path);
      return `/inference-defaults?${params}`;
    },
    predictions: (id: string, offset = 0, limit = 25) =>
      `/inference-runs/${encodeURIComponent(id)}/predictions?limit=${limit}&offset=${offset}`,
  },
  inferencePaths: resource("/inference-paths"),
  predictions: {
    ...resource("/predictions"),
    image: (id: string) => `/predictions/${encodeURIComponent(id)}/image`,
  },
  evaluations: resource("/evaluations"),
  sweeps: resource("/threshold-sweeps"),
  comparisons: resource("/comparisons"),
  artifacts: {
    ...resource("/artifacts"),
    importPredictions: "/artifacts/import-predictions",
    download: (id: string) => `/artifacts/${encodeURIComponent(id)}/download`,
  },
  jobs: {
    ...resource("/jobs"),
    list: (status = "", limit = 100) =>
      `/jobs?limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ""}`,
    logs: (id: string, cursor: number) =>
      `/jobs/${encodeURIComponent(id)}/logs?cursor=${cursor}`,
    cancel: (id: string) => `/jobs/${encodeURIComponent(id)}/cancel`,
  },
};
