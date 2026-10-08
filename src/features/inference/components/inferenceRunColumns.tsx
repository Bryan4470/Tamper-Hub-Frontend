import type { Row } from "@/api/types";
import { runColumns } from "@/components/data-display/runColumns";
import { number } from "@/utils/format";

export const inferenceRunColumns = [
  {
    key: "name",
    label: "Run / input",
    render: (run: Row) => (
      <>
        <strong>{run.display.name}</strong>
        <small className="subcell">{run.display.description}</small>
        {run.display.input && (
          <small className="subcell result-path">{run.display.input}</small>
        )}
      </>
    ),
  },
  {
    key: "model",
    label: "Model / checkpoint",
    render: (run: Row) => (
      <>
        <span>{run.display.model}</span>
        <small className="subcell result-path">
          {run.display.checkpoint || "Checkpoint unavailable"}
        </small>
      </>
    ),
  },
  {
    key: "results",
    label: "Results",
    render: (run: Row) => (
      <>
        <span>
          {number(run.processed_samples)} processed
          {typeof run.total_samples === "number"
            ? ` / ${number(run.total_samples)} total`
            : ""}
        </span>
        <small className="subcell">
          {number(run.genuine_samples)} genuine · {number(run.tampered_samples)}{" "}
          tampered
        </small>
        <small className="subcell">{number(run.failed_samples)} failures</small>
      </>
    ),
  },
  ...runColumns.filter((column) => column.key !== "name"),
];
