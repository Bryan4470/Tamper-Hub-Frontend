import type { PageName } from "@/app/types";

export const navigation: [PageName, string, string][] = [
  ["overview", "Home", "◫"],
  ["training", "Training", "↗"],
  ["inference", "Inference", "◎"],
  ["results", "Saved results", "▤"],
  ["evaluation", "Evaluation", "⌁"],
  ["comparison", "Comparison", "⇄"],
  ["models", "Models", "▣"],
  ["datasets", "Datasets", "▦"],
  ["jobs", "Job monitor", "≡"],
];
export const titles: Record<PageName, [string, string]> = {
  models: [
    "Model registry",
    "Register checkpoints, then choose a model for inference.",
  ],
  results: [
    "Saved results",
    "Explore the training history, evaluations, and predictions already on disk.",
  ],
  overview: [
    "Welcome to Tamper Hub",
    "From a dataset to a decision. Keep every experiment connected.",
  ],
  datasets: [
    "Dataset library",
    "Register, inspect, and version the data behind your models.",
  ],
  training: [
    "Train a model",
    "Choose your data, configure an experiment, and follow every epoch.",
  ],
  inference: [
    "Run inference",
    "Predict images, folders, or CSV batches without registration.",
  ],
  evaluation: [
    "Evaluate performance",
    "Turn saved predictions into measurable operating decisions.",
  ],
  comparison: [
    "Compare models",
    "Measure improvements on matching samples and explicit thresholds.",
  ],
  jobs: [
    "Job monitor",
    "Follow queued work, live progress, and execution logs.",
  ],
  settings: [
    "Connection settings",
    "Connect this dashboard to your tamper operations backend.",
  ],
};
