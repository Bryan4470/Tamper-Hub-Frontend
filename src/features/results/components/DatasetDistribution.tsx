import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import type { DatasetDistribution as Distribution } from "@/api/studioTypes";
import { Table } from "@/components/data-display/Table";
import { Empty } from "@/components/ui/Empty";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";

export function DatasetDistribution({
  runId,
  revision,
}: {
  runId: string;
  revision: number;
}) {
  const remote = useRemote<Distribution | null>(
    endpoints.studio.distribution(runId),
    null,
    revision,
    60000,
  );
  const [field, setField] = useState("fraud_type");
  const data = remote.data;
  const fields = Object.keys(data?.counts || {});
  const activeField = fields.includes(field) ? field : fields[0];
  const label = (value: string) => value.replaceAll("_", " ");
  return (
    <div>
      <h3>Dataset distribution</h3>
      <p className="muted">
        Counts come from this run’s saved train, validation, and test manifests.
      </p>
      <Notice error>{remote.error}</Notice>
      {remote.loading && <p role="status">Reading dataset distribution…</p>}
      {data && (
        <>
          {data.warnings.map((warning) => (
            <Notice error key={warning}>
              {warning}
            </Notice>
          ))}
          {!data.total ? (
            <Empty title="Exact split manifests are unavailable">
              This run has no saved dataset rows. Source CSV inventory is shown
              below when available.
            </Empty>
          ) : (
            <>
              <div className="detail-summary">
                <strong>{data.total.toLocaleString()} dataset rows</strong>
                <span>{data.unique_images.toLocaleString()} unique images</span>
                <span>
                  {data.sources.length.toLocaleString()} source CSVs in
                  inventory
                </span>
              </div>
              <Notice
                error={Boolean(data.cross_split_images || data.duplicate_rows)}
              >
                {data.cross_split_images || data.duplicate_rows
                  ? `${data.cross_split_images} image paths occur across splits; ${data.duplicate_rows} duplicate rows occur within splits.`
                  : "No repeated image paths were detected across the saved splits."}
              </Notice>
              <h4>Train / validation / test allocation</h4>
              <Table
                rows={data.splits}
                columns={[
                  { key: "split", label: "Split" },
                  { key: "samples", label: "Samples" },
                  {
                    key: "share",
                    label: "Share",
                    render: (row) => (
                      <span>
                        <meter
                          aria-label={`${row.split} share`}
                          min={0}
                          max={data.total}
                          value={row.samples}
                        />{" "}
                        {((row.samples / data.total) * 100).toFixed(1)}%
                      </span>
                    ),
                  },
                  { key: "genuine", label: "Genuine" },
                  { key: "tamper", label: "Tamper" },
                ]}
              />
              {Boolean(data.card_balance?.length) && (
                <>
                  <h4>Class balance by card type and split</h4>
                  <Table
                    rows={data.card_balance || []}
                    columns={[
                      { key: "split", label: "Split" },
                      { key: "card_type", label: "Card type" },
                      { key: "samples", label: "Samples" },
                      { key: "genuine", label: "Genuine" },
                      { key: "tamper", label: "Tamper" },
                      { key: "unknown", label: "Unknown class" },
                      {
                        key: "genuine_share",
                        label: "Genuine %",
                        render: (row) =>
                          `${((100 * row.genuine) / row.samples).toFixed(1)}%`,
                      },
                      {
                        key: "tamper_share",
                        label: "Tamper %",
                        render: (row) =>
                          `${((100 * row.tamper) / row.samples).toFixed(1)}%`,
                      },
                    ]}
                  />
                </>
              )}
              <h4>Class, card type, and metadata breakdown</h4>
              <Field label="Distribution field">
                <select
                  value={activeField || ""}
                  onChange={(event) => setField(event.target.value)}
                >
                  {fields.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Table
                rows={data.counts[activeField] || []}
                columns={[
                  { key: "split", label: "Split" },
                  {
                    key: "value",
                    label: activeField ? label(activeField) : "Value",
                  },
                  { key: "samples", label: "Samples" },
                  {
                    key: "share",
                    label: "Share of split",
                    render: (row) => {
                      const total =
                        data.splits.find((split) => split.split === row.split)
                          ?.samples || 1;
                      return (
                        <span>
                          <meter
                            aria-label={`${row.split} ${row.value} share`}
                            min={0}
                            max={total}
                            value={row.samples}
                          />{" "}
                          {((row.samples / total) * 100).toFixed(1)}%
                        </span>
                      );
                    },
                  },
                ]}
              />
            </>
          )}
          {data.sources.length > 0 && (
            <>
              <h4>Source CSV inventory</h4>
              <Table
                rows={data.sources}
                columns={[...new Set(data.sources.flatMap(Object.keys))].map(
                  (key) => ({ key, label: label(key) }),
                )}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
