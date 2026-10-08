import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Chart } from "@/components/data-display/Chart";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Status } from "@/components/ui/Status";
import { useRemote } from "@/hooks/useRemote";
import { pct } from "@/utils/format";

export function TrainingRunDetails(
  props: Pick<HubProps, "revision" | "models" | "busy" | "act" | "go"> & {
    selected: string;
  },
) {
  const { selected } = props;
  const details = useRemote<Row>(
    selected ? endpoints.training.detail(selected) : null,
    {},
    props.revision,
  );
  const history = useRemote<Row>(
    selected ? endpoints.training.metrics(selected) : null,
    { items: [] },
    props.revision,
  );
  const checkpoints = useRemote<Row[]>(
    selected ? endpoints.training.checkpoints(selected) : null,
    [],
    props.revision,
    15000,
  );

  return (
    <Card
      title={details.data.name || "Training details"}
      action={
        details.data.job_id && (
          <button
            className="secondary"
            onClick={() => props.go("jobs", details.data.job_id)}
          >
            Open job log
          </button>
        )
      }
    >
      <Notice error>{details.error || details.data.error}</Notice>
      <div className="detail-summary">
        <Status value={details.data.status} />
        <span>{details.data.phase}</span>
        <span>
          {details.data.split_counts &&
            `${details.data.split_counts.train} train / ${details.data.split_counts.val} validation`}
        </span>
      </div>
      <Chart
        rows={history.data.items || []}
        xKey="epoch"
        title="Training and validation loss"
        lines={[
          { key: "train_loss", label: "Training", color: "#23836c" },
          { key: "val_loss", label: "Validation", color: "#d78342" },
        ]}
      />
      <h3 className="section-label">Checkpoints</h3>
      {checkpoints.data.length ? (
        <Table
          rows={checkpoints.data}
          columns={[
            { key: "name", label: "Checkpoint" },
            {
              key: "size_bytes",
              label: "Size",
              render: (r) => `${(r.size_bytes / 1024 / 1024).toFixed(1)} MB`,
            },
            {
              key: "metrics",
              label: "Validation FAR / FRR",
              render: (r) => `${pct(r.metrics.far)} / ${pct(r.metrics.frr)}`,
            },
            {
              key: "register",
              label: "",
              render: (r) => (
                <button
                  className="secondary small"
                  disabled={
                    props.busy ||
                    props.models.some(
                      (m) => m.checkpoint_path === r.checkpoint_path,
                    )
                  }
                  onClick={() =>
                    props.act(
                      () =>
                        submit(
                          endpoints.models.create,
                          {
                            name: `${details.data.name} · ${r.name}`,
                            checkpoint_path: r.checkpoint_path,
                            config_path: r.config_path,
                          },
                          false,
                        ),
                      "Checkpoint registered for inference.",
                    )
                  }
                >
                  {props.models.some(
                    (m) => m.checkpoint_path === r.checkpoint_path,
                  )
                    ? "Registered"
                    : "Register model"}
                </button>
              ),
            },
          ]}
        />
      ) : (
        <p className="muted">Checkpoints appear as the trainer saves them.</p>
      )}
    </Card>
  );
}
