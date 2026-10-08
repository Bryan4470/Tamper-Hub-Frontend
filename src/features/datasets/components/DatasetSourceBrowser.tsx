import { useEffect, useMemo, useRef, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Row } from "@/api/types";
import type { HubProps } from "@/app/types";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useRemote } from "@/hooks/useRemote";
import { number } from "@/utils/format";

type DatasetSource = {
  id: string;
  name: string;
  path: string;
  relative_path: string;
  role: "train" | "test";
  card_type: string;
  default_label: string | null;
  rows: number;
  duplicate_rows: number;
  labels: Record<string, number>;
  configured: boolean;
};

type SourceResponse = {
  items: DatasetSource[];
  root_dir: string;
  test_dir: string;
};

const empty: SourceResponse = { items: [], root_dir: "", test_dir: "" };

export function DatasetSourceBrowser(
  props: Pick<HubProps, "revision" | "busy" | "act"> & {
    onCreated: (id: string) => void;
  },
) {
  const sources = useRemote<SourceResponse>(
    endpoints.datasetSources,
    empty,
    props.revision,
    300000,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"train" | "test">("train");
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && sources.data.items.length) {
      initialized.current = true;
      setSelected(
        sources.data.items
          .filter((item) => item.configured && item.role === role)
          .map((item) => item.path),
      );
    }
  }, [role, sources.data.items]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sources.data.items.filter(
      (item) =>
        item.role === role &&
        (!term || item.relative_path.toLowerCase().includes(term)),
    );
  }, [query, role, sources.data.items]);
  const groups = useMemo(() => {
    const result = new Map<string, DatasetSource[]>();
    for (const item of visible) {
      const key = `${item.role}|${item.card_type}|${item.default_label || "mixed"}`;
      result.set(key, [...(result.get(key) || []), item]);
    }
    return [...result.entries()];
  }, [visible]);
  const selectedSources = sources.data.items.filter((item) =>
    selected.includes(item.path),
  );
  const selectedRows = selectedSources.reduce(
    (sum, item) => sum + item.rows,
    0,
  );

  function toggle(paths: string[], checked: boolean) {
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...paths])]
        : current.filter((path) => !paths.includes(path)),
    );
  }

  return (
    <Card
      title="Dataset sources"
      subtitle="Choose CSV manifests from the configured training and testing roots."
      action={
        <button
          className="secondary"
          type="button"
          onClick={() =>
            setSelected(
              sources.data.items
                .filter((item) => item.configured && item.role === role)
                .map((item) => item.path),
            )
          }
        >
          Use config selection
        </button>
      }
    >
      <Notice error>{sources.error}</Notice>
      <div className="source-toolbar">
        <Field label="Find a CSV">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search filename or folder"
          />
        </Field>
        <Field label="Dataset role">
          <select
            value={role}
            onChange={(event) => {
              const next = event.target.value as "train" | "test";
              setRole(next);
              setSelected(
                sources.data.items
                  .filter((item) => item.configured && item.role === next)
                  .map((item) => item.path),
              );
            }}
          >
            <option value="train">Training pool</option>
            <option value="test">Testing pool</option>
          </select>
        </Field>
      </div>
      <div className="source-root" title={sources.data.root_dir}>
        Scanning <code>{sources.data.root_dir || "configured data root"}</code>
      </div>
      <div className="source-groups">
        {groups.map(([key, items]) => {
          const [groupRole, card, label] = key.split("|");
          const paths = items.map((item) => item.path);
          const checked = paths.every((path) => selected.includes(path));
          return (
            <section className="source-group" key={key}>
              <label className="source-group-head">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggle(paths, event.target.checked)}
                />
                <span>
                  <strong>
                    {groupRole === "train" ? "Training" : "Testing"} ·{" "}
                    {card.replaceAll("_", " ")} · {label}
                  </strong>
                  <small>
                    {items.length} CSVs ·{" "}
                    {number(items.reduce((sum, item) => sum + item.rows, 0))}{" "}
                    samples
                  </small>
                </span>
              </label>
              <div className="source-items">
                {items.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.path)}
                      onChange={(event) =>
                        toggle([item.path], event.target.checked)
                      }
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {number(item.rows)} samples ·{" "}
                        {Object.entries(item.labels)
                          .map(([key, value]) => `${key} ${number(value)}`)
                          .join(" · ")}
                        {item.duplicate_rows > 0 && (
                          <> · {number(item.duplicate_rows)} repeated rows</>
                        )}
                      </small>
                    </span>
                    {item.configured && <em>config</em>}
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <form
        className="collection-save"
        onSubmit={(event) => {
          event.preventDefault();
          props.act(async () => {
            const created = (await submit(
              endpoints.datasetCollections,
              { name, source_paths: selected },
              false,
            )) as Row;
            props.onCreated(created.id);
            setName("");
          }, "Dataset collection saved as an immutable snapshot.");
        }}
      >
        <div>
          <strong>
            {selected.length} {role === "train" ? "training" : "testing"} CSVs
          </strong>
          <span>{number(selectedRows)} source rows</span>
        </div>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Collection name"
          aria-label="Collection name"
        />
        <BusyButton busy={props.busy} disabled={!selected.length}>
          Save collection
        </BusyButton>
      </form>
    </Card>
  );
}
