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
                  {filtered
                    .filter((source) => source.role === role)
                    .map((source) => (
                      <label key={source.path}>
                        <input
                          type="checkbox"
                          checked={active.includes(source.path)}
                          onChange={(event) =>
                            toggle(source.path, event.target.checked)
                          }
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
                        {source.configured && (
                          <em className="config-badge">config</em>
                        )}
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
