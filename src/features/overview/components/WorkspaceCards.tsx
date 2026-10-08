import type { HubProps, PageName } from "@/app/types";
import { HubIcon } from "@/components/ui/HubIcon";
const workspaces: {
  page: PageName;
  title: string;
  description: string;
  action: string;
}[] = [
  {
    page: "training",
    title: "Training",
    description:
      "Choose your compute, prepare datasets, and train a new tamper detection model.",
    action: "Configure an experiment",
  },
  {
    page: "inference",
    title: "Inference",
    description:
      "Score datasets across model checkpoints or inspect a single document image.",
    action: "Run predictions",
  },
  {
    page: "results",
    title: "Summary & evaluation",
    description:
      "Explore saved results, tune thresholds, and compare model performance.",
    action: "Explore saved results",
  },
  {
    page: "jobs",
    title: "Job monitor",
    description:
      "Follow queued work, check progress, and inspect training and inference logs.",
    action: "View activity",
  },
  {
    page: "models",
    title: "Model registry",
    description:
      "Organize model checkpoints and their configurations for your next benchmark.",
    action: "Manage checkpoints",
  },
  {
    page: "datasets",
    title: "Data management",
    description:
      "Register datasets, inspect image samples, and validate your training data.",
    action: "Browse datasets",
  },
];
export function WorkspaceCards({ go }: Pick<HubProps, "go">) {
  return (
    <section className="workspace-cards" aria-label="Choose a workspace">
      {workspaces.map(({ page, title, description, action }) => (
        <button
          className={"workspace-card theme-" + page}
          key={page}
          aria-label={title}
          onClick={() => go(page)}
        >
          <span className="workspace-icon">
            <HubIcon name={page} size={34} />
          </span>
          <h2>{title}</h2>
          <p>{description}</p>
          <span className="workspace-action">
            {action}
            <span aria-hidden="true">→</span>
          </span>
        </button>
      ))}
    </section>
  );
}
