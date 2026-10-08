export type ReportSource = {
  runId?: string;
  path?: string;
  artifactId?: string;
};
export type InferenceReportData = {
  directory: string;
  status: string;
  full_results: boolean;
  summary: {
    genuine: number;
    tampered: number;
    total: number;
    failed: number;
    unlabeled: number;
  };
  metrics: Record<string, number | null>;
  error_counts: { fp: number; fn: number; failed: number };
  per_csv: Record<string, string | number | null>[];
  files: { name: string; size_bytes: number }[];
  run_info: string;
  provenance?: Record<string, string>;
  warnings: string[];
};
export type ReportPrediction = {
  row_index: number;
  image_path: string;
  prediction: string;
  ground_truth: string;
  prob_tampered: number | null;
  threshold: number | null;
  outcome: string;
  error?: string;
};
