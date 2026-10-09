import { useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import { number } from "@/utils/format";

export type DatasetSource = {
  id?: string;
  name?: string;
  path: string;
  relative_path?: string;
  role: "train" | "test";
  card_type?: string;
  default_label?: string | null;
  rows?: number;
  configured: boolean;
};

export type DatasetMode = "config" | "custom";

export function DatasetSelection({
  mode,
  sources,
  selected,
  onModeChange,
  onSelectedChange,
}: {
  mode: DatasetMode;
  sources: DatasetSource[];
  selected: string[];
  onModeChange: (mode: DatasetMode) => void;
  onSelectedChange: (paths: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const configured = sources.filter((source) => source.configured);
  const active =
    mode === "config" ? configured.map((source) => source.path) : selected;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sources.filter((source) =>
      (source.relative_path || source.name || source.path)
        .toLowerCase()
        .includes(term),
    );
  }, [query, sources]);

  const summary = (role: "train" | "test") => {
    const items = sources.filter(
      (source) => source.role === role && active.includes(source.path),
    );
    return `${items.length} CSV${items.length === 1 ? "" : "s"} · ${number(
      items.reduce((total, source) => total + (source.rows || 0), 0),
    )} samples`;
  };

  function toggle(path: string, checked: boolean) {
    onSelectedChange(
      checked
        ? [...new Set([...selected, path])]
        : selected.filter((item) => item !== path),
    );
  }

  function renderSource(source: DatasetSource) {
    return (
      <label className="csv-source-option" key={source.path}>
        <input
          type="checkbox"
          checked={active.includes(source.path)}
          onChange={(event) => toggle(source.path, event.target.checked)}
        />
        <span>
          {source.relative_path || source.name || source.path}
          <small>
            {number(source.rows || 0)} samples
            {source.card_type
              ? ` · ${source.card_type.replaceAll("_", " ")}`
              : ""}
          </small>
        </span>
        {source.configured && <em className="config-badge">config</em>}
      </label>
    );
  }

  function sourceGroups(role: "train" | "test") {
    const groups = new Map<string, Map<string, DatasetSource[]>>();
    for (const source of filtered.filter((item) => item.role === role)) {
      const folders = (source.relative_path || source.path)
        .split("/")
        .slice(0, -1);
      const label =
        source.default_label ||
        folders.find((part) => part === "genuine" || part === "tamper") ||
        "other";
      const card =
        source.card_type ||
        folders.find(
          (part) =>
            part.startsWith("mykadfront") || part.startsWith("mykadback"),
        ) ||
        "Other card types";
      if (!groups.has(label)) groups.set(label, new Map());
      const cards = groups.get(label)!;
      if (!cards.has(card)) cards.set(card, []);
      cards.get(card)!.push(source);
    }
    return groups;
  }
  const folderOrder = [
    "genuine",
    "tamper",
    "mykadfront",
    "mykadback",
    "mykadfront_2026",
    "mykadback_2026",
  ];
  const compareFolders = (a: string, b: string) => {
    const rank = (value: string) =>
      folderOrder.includes(value)
        ? folderOrder.indexOf(value)
        : folderOrder.length;
    return rank(a) - rank(b) || a.localeCompare(b);
  };

  return (
    <div className="dataset-choice">
      <div
        className="choice-grid"
        role="radiogroup"
        aria-label="Dataset source"
      >
        <label className={`choice-card ${mode === "config" ? "selected" : ""}`}>
          <input
            type="radio"
            name="dataset-mode"
            checked={mode === "config"}
            onChange={() => onModeChange("config")}
          />
          <span>
            <strong>Use datasets from config</strong>
            <small>
              Recommended · automatically follows the selected template
            </small>
            <em>
              Training: {summary("train")} · Testing: {summary("test")}
            </em>
          </span>
        </label>
        <label className={`choice-card ${mode === "custom" ? "selected" : ""}`}>
          <input
            type="radio"
            name="dataset-mode"
            checked={mode === "custom"}
            onChange={() => onModeChange("custom")}
          />
          <span>
            <strong>Custom selection</strong>
            <small>
              Choose the training and testing CSV files for this run
            </small>
            <em>
              Training: {summary("train")} · Testing: {summary("test")}
            </em>
          </span>
        </label>
      </div>
      {mode === "config" && (
        <details className="disclosure configured-csvs">
          <summary>View CSVs from config ({configured.length})</summary>
          <p className="muted">
            CSVs marked as configured by the server’s config.yaml. Expand each
            group to review the file paths and sample counts.
          </p>
          <div className="two-columns">
            {(["train", "test"] as const).map((role) => {
              const items = configured.filter((source) => source.role === role);
              return (
                <details className="inner-details" key={role} open>
                  <summary>
                    {role === "train" ? "Training CSVs" : "Testing CSVs"}
                    {" · "}
                    {summary(role)}
                  </summary>
                  {items.length ? (
                    <ol className="configured-csv-list">
                      {items.map((source) => (
                        <li key={source.path}>
                          <strong>
                            {source.relative_path || source.name || source.path}
                          </strong>
                          <small>
                            {number(source.rows || 0)} samples
                            {source.card_type
                              ? ` · ${source.card_type.replaceAll("_", " ")}`
                              : ""}
                          </small>
                          <code>{source.path}</code>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">
                      No configured CSVs found in this group.
                    </p>
                  )}
                </details>
              );
            })}
          </div>
        </details>
      )}
      {mode === "custom" && (
        <div className="custom-datasets">
          <Field label="Find a CSV">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search filename or folder"
            />
          </Field>
          <div className="two-columns">
            {(["train", "test"] as const).map((role) => (
              <fieldset className="picker" key={role}>
                <legend>
                  {role === "train" ? "Training CSVs" : "Testing CSVs"}{" "}
                  <span>
                    {
                      filtered.filter(
                        (source) =>
                          source.role === role && active.includes(source.path),
                      ).length
                    }{" "}
                    selected
                  </span>
                </legend>
                <div className="picker-items source-picker-items">
                  {[...sourceGroups(role).entries()]
                    .sort(([a], [b]) => compareFolders(a, b))
                    .map(([label, cards]) => (
                      <section className="csv-label-group" key={label}>
                        <h3>
                          {label === "genuine"
                            ? "Genuine"
                            : label === "tamper"
                              ? "Tamper"
                              : "Other"}
                        </h3>
                        {[...cards.entries()]
                          .sort(([a], [b]) => compareFolders(a, b))
                          .map(([card, items]) => (
                            <section className="csv-card-group" key={card}>
                              <h4>
                                {card}{" "}
                                <span>
                                  {
                                    items.filter((source) =>
                                      active.includes(source.path),
                                    ).length
                                  }
                                  /{items.length} selected
                                </span>
                              </h4>
                              {items.map(renderSource)}
                            </section>
                          ))}
                      </section>
                    ))}
                  {!filtered.some((source) => source.role === role) && (
                    <p>No CSVs match your search.</p>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
