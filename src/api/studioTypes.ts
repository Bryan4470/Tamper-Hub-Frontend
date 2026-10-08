export type ResultRow = Record<string, string | number | boolean | null>;

export type SavedRun = {
  inference_id?: string;
  id: string;
  name: string;
  kind: "training" | "training-legacy" | "inference";
  status: string;
  directory: string;
  modified: string;
  error: string;
};

export type SavedRunList = {
  items: SavedRun[];
  roots: string[];
  warnings: string[];
};

export type SavedArtifact = {
  id: string;
  label: string;
  filename: string;
  split: "validation" | "test" | "inference" | "training";
  kind: "metrics" | "predictions" | "sweep" | "history";
  derived: boolean;
};

export type SavedRunDetail = {
  run: SavedRun;
  history: ResultRow[];
  artifacts: SavedArtifact[];
  metrics: ResultRow;
  warnings: string[];
};

export type SavedCheckpoint = {
  id: string;
  run_id: string;
  run_name: string;
  run_kind: "training" | "training-legacy";
  name: string;
  checkpoint_path: string;
  config_path: string;
  size_bytes: number;
};

export type SavedCheckpointList = {
  items: SavedCheckpoint[];
};

export type SavedTable = {
  items: ResultRow[];
  columns: string[];
  total: number;
  unfiltered: number;
  offset: number;
  limit: number;
};

export type DatasetDistribution = {
  total: number;
  unique_images: number;
  cross_split_images: number;
  duplicate_rows: number;
  splits: { split: string; samples: number; genuine: number; tamper: number }[];
  counts: Record<string, { split: string; value: string; samples: number }[]>;
  card_balance?: ResultRow[];
  sources: ResultRow[];
  warnings: string[];
};

export type EpochRecord = {
  checkpoint: string;
  epoch: number | null;
  split: "validation" | "test";
  metrics: ResultRow;
  metric_source: string;
  history: ResultRow[];
  datasets: ResultRow[];
  predictions: SavedArtifact[];
};

export type EpochList = { items: EpochRecord[]; warnings: string[] };
export type CardPerformance = {
  overall: ResultRow;
  cards: ResultRow[];
  warnings: string[];
};
