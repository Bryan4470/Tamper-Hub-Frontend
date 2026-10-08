import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Table } from "@/components/data-display/Table";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { number, short } from "@/utils/format";

export function DatasetTable(
  props: Pick<HubProps, "datasets" | "busy" | "act"> & {
    selected: string;
    onSelect: (id: string) => void;
  },
) {
  const { selected } = props;

  function remove(dataset: Row) {
    if (
      !window.confirm(
        `Delete “${dataset.name}”? The saved snapshot will be removed, but its source CSVs and images will not be deleted.`,
      )
    )
      return;
    void props.act(async () => {
      await api(endpoints.datasets.detail(dataset.id), { method: "DELETE" });
      if (selected === dataset.id) props.onSelect("");
    }, "Dataset collection deleted. Source CSVs and images were not deleted.");
  }

  return (
    <Card
      title="Saved collections"
      subtitle={`${props.datasets.length} immutable dataset snapshots`}
    >
      {props.datasets.length ? (
        <Table
          rows={props.datasets}
          selected={selected}
          onRow={(r) => {
            props.onSelect(r.id);
          }}
          columns={[
            {
              key: "name",
              label: "Dataset",
              render: (r) => (
                <>
                  <strong>{r.name}</strong>
                  <small className="subcell">{short(r.id)}</small>
                </>
              ),
            },
            { key: "rows", label: "Samples", render: (r) => number(r.rows) },
            {
              key: "labels",
              label: "Labels",
              render: (r) =>
                Object.entries(r.labels)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · "),
            },
            {
              key: "dataset_role",
              label: "Role",
              render: (r) => r.dataset_role || "legacy",
            },
            {
              key: "version",
              label: "Version",
              render: (r) => <code>{r.version.slice(0, 10)}</code>,
            },
            { key: "missing_images", label: "Missing images" },
            {
              key: "duplicates_removed",
              label: "Deduplicated",
              render: (r) => number(r.duplicates_removed || 0),
            },
            {
              key: "actions",
              label: "Actions",
              render: (r) => (
                <button
                  className="danger-button small"
                  disabled={props.busy}
                  onClick={() => remove(r)}
                >
                  Delete
                </button>
              ),
            },
          ]}
        />
      ) : (
        <Empty title="Create your first collection">
          Select CSV sources and save them as a reusable snapshot.
        </Empty>
      )}
    </Card>
  );
}
