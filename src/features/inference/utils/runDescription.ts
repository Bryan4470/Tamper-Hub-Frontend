import type { Row } from "@/api/types";

export const inputLabels: Record<string, string> = {
  image: "Single image",
  directory: "Image folder",
  csv: "CSV file",
  csv_dir: "CSV folder",
  batch_config: "Batch YAML",
};
export const cardLabels: Record<string, string> = {
  mykadfront: "MyKad front",
  mykadback: "MyKad back",
  mykadfront_2026: "MyKad front 2026",
  mykadback_2026: "MyKad back 2026",
};
export function pathName(path: string = "") {
  return (
    path
      .trim()
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || ""
  );
}
export function inferenceName(input: string, checkpoint: string, card: string) {
  return [
    pathName(input) || "Input",
    pathName(checkpoint).replace(/\.(pth|pt)$/i, "") || "Checkpoint",
    cardLabels[card] || card,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 120);
}
export function describeRun(run: Row, models: Row[], datasets: Row[]) {
  const request = run.request || {};
  const selectedModels = models.filter((model) =>
    [request.model_id, ...(request.model_ids || [])].includes(model.id),
  );
  const checkpoint =
    request.checkpoint_path || selectedModels[0]?.checkpoint_path || "";
  const input =
    request.input_path ||
    datasets
      .filter((dataset) => (request.dataset_ids || []).includes(dataset.id))
      .map((dataset) => dataset.source_path || dataset.name)
      .join(", ");
  const generic = [
    "Inference",
    ...Object.values(inputLabels).map((label) => `${label} inference`),
  ];
  const name =
    input && checkpoint && generic.includes(run.name)
      ? inferenceName(input, checkpoint, request.card_type || "")
      : run.name || "Inference run";
  return {
    name,
    input,
    description: [
      (request.uploaded_files
        ? `Uploaded images (${request.uploaded_files.length})`
        : inputLabels[request.input_type]) ||
        (request.dataset_ids
          ? "Registered datasets"
          : "Input details unavailable"),
      cardLabels[request.card_type],
      typeof request.crop === "boolean"
        ? `Cropping ${request.crop ? "enabled" : "disabled"}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    model:
      selectedModels.map((model) => model.name).join(", ") ||
      (checkpoint
        ? pathName(checkpoint.replace(/[\\/][^\\/]+$/, ""))
        : "Unavailable"),
    checkpoint:
      request.checkpoint_path ||
      selectedModels
        .map((model) => model.checkpoint_path)
        .filter(Boolean)
        .join(", "),
  };
}
