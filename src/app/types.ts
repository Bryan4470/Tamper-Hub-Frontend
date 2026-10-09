import type { Row } from "@/api/types";

export type PageName =
  | "results"
  | "models"
  | "overview"
  | "datasets"
  | "training"
  | "inference"
  | "gradcam"
  | "evaluation"
  | "comparison"
  | "jobs"
  | "notebook"
  | "settings";
export type HubProps = {
  datasets: Row[];
  models: Row[];
  gpus: Row[];
  revision: number;
  busy: boolean;
  target: string;
  workspace: string;
  storage: Record<string, string>;
  act: (work: () => Promise<unknown>, message?: string) => Promise<void>;
  go: (page: PageName, target?: string) => void;
};
