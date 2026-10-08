import { cardPerformance, checkpointName } from "./cardPerformance.ts";
import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readDatasetDistribution } from "./datasetDistribution.ts";
import { csvRows } from "./csv.ts";
import type {
  ResultRow,
  EpochList,
  EpochRecord,
  SavedArtifact,
  SavedCheckpoint,
  SavedRun,
  SavedRunDetail,
  SavedRunList,
  SavedTable,
} from "../src/api/studioTypes.ts";

type Roots = {
  project: string;
  checkpoints: string;
  legacyCheckpoints: string;
  workspace: string;
  results: string;
  legacyResults?: string;
  hubCheckpoints?: string;
};
type Artifact = SavedArtifact & {
  path?: string;
  source?: "validation" | "legacy";
};
type Run = SavedRun & { metadata: Record<string, unknown> };
const idFor = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24);
const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
};
const exists = async (path: string) =>
  stat(path).then(
    (s) => s.isFile(),
    () => false,
  );

export function studioRoots(env = process.env): Roots {
  const project = resolve(
    env.TAMPER_STUDIO_PROJECT || "../face-tamper-multiclass",
  );
  return {
    project,
    checkpoints: resolve(
      env.TRAINING_STUDIO_CHECKPOINTS || "/mnt5/dataset/tamper/checkpoints",
    ),
    legacyCheckpoints: resolve(
      env.TAMPER_STUDIO_LEGACY_CHECKPOINTS || join(project, "checkpoints"),
    ),
    workspace: resolve(
      env.TRAINING_STUDIO_WORKSPACE ||
        join(project, "training_studio/workspace"),
    ),
    results: resolve(
      env.TAMPER_STUDIO_RESULTS ||
        join(
          env.TAMPER_API_WORKSPACE || "/mnt5/dataset/tamper/tamper_hub",
          "results",
        ),
    ),
    legacyResults: join(project, "results"),
    hubCheckpoints: join(
      env.TAMPER_API_WORKSPACE || "/mnt5/dataset/tamper/tamper_hub",
      "checkpoints",
    ),
  };
}

export function createStudioReader(roots: Roots) {
  const allowed = [
    roots.checkpoints,
    ...(roots.hubCheckpoints ? [roots.hubCheckpoints] : []),
    roots.legacyCheckpoints,
    roots.workspace,
    roots.results,
    ...(roots.legacyResults ? [roots.legacyResults] : []),
  ];
  let runs = new Map<string, Run>();
  let scanned = false;

  // Resolve both sides to reject symlink escapes as well as path traversal.
  async function safe(path: string) {
    const resolved = await realpath(path);
    const canonicalRoots = await Promise.all(
      allowed.map((root) => realpath(root).catch(() => root)),
    );
    if (!canonicalRoots.some((root) => inside(root, resolved)))
      throw new Error("Result path is outside the configured Studio roots");
    return resolved;
  }

  async function textFile(path: string) {
    const checked = await safe(path);
    if ((await stat(checked)).size > 8 * 1024 * 1024)
      throw new Error("Result metadata file is too large");
    return readFile(checked, "utf8");
  }

  async function metadata(path: string): Promise<Record<string, unknown>> {
    if (!(await exists(path))) return {};
    const value: unknown = JSON.parse(await textFile(path));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Expected a JSON object");
    return value as Record<string, unknown>;
  }

  async function entries(path: string) {
    return readdir(await safe(path), { withFileTypes: true });
  }

  function publicRun(run: Run): SavedRun {
    const { metadata: _metadata, ...value } = run;
    return value;
  }

  async function list(): Promise<SavedRunList> {
    const found = new Map<string, Run>();
    const warnings: string[] = [];
    const warn = (path: string, error: unknown) =>
      warnings.push(`${path}: ${(error as Error).message}`);
    const isTraining = (kind: Run["kind"]) =>
      kind === "training" || kind === "training-legacy";
    async function add(
      path: string,
      kind: Run["kind"],
      record: Record<string, unknown> = {},
    ) {
      const directory = await safe(path);
      const id = idFor(directory);
      if (found.has(id)) return;
      const history = await exists(join(directory, "logs/training_log.csv"));
      if (
        isTraining(kind) &&
        !history &&
        !(await exists(join(directory, "config.yaml")))
      )
        return;
      let saved = record;
      if (isTraining(kind)) {
        try {
          saved = {
            ...(await metadata(join(directory, "studio_metadata.json"))),
            ...record,
          };
        } catch (error) {
          warn(directory, error);
        }
      }
      let status = String(saved.status || "saved");
      if (!saved.status && isTraining(kind)) {
        const checkpoints = await readdir(join(directory, "checkpoints")).catch(
          () => [],
        );
        status =
          checkpoints.some((file) => file.endsWith(".pth")) ||
          (await exists(join(directory, "eval_results/report.html")))
            ? "completed"
            : history
              ? "incomplete"
              : "configuration only";
      }
      found.set(id, {
        id,
        directory,
        kind,
        status,
        name: String(saved.name || basename(directory)),
        modified: (await stat(directory)).mtime.toISOString(),
        error: String(saved.error || ""),
        metadata: saved,
      });
    }
    async function scanChildren(
      root: string,
      visit: (path: string) => Promise<void>,
    ) {
      try {
        for (const entry of await entries(root)) {
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
          const path = join(root, entry.name);
          try {
            await visit(path);
          } catch (error) {
            warn(path, error);
          }
        }
      } catch (error) {
        warn(root, error);
      }
    }
    await scanChildren(roots.checkpoints, (path) => add(path, "training"));
    if (roots.hubCheckpoints)
      await scanChildren(roots.hubCheckpoints, (path) => add(path, "training"));
    await scanChildren(roots.legacyCheckpoints, (path) =>
      add(path, "training-legacy"),
    );
    await scanChildren(join(roots.workspace, "runs"), async (path) => {
      const record = await metadata(join(path, "run.json"));
      if (typeof record.artifact_dir === "string" && record.artifact_dir)
        await add(
          resolve(roots.project, record.artifact_dir),
          "training",
          record,
        );
    });
    await scanChildren(
      join(roots.workspace, "inference_jobs"),
      async (path) => {
        const record = await metadata(join(path, "job.json"));
        if (typeof record.output_dir === "string" && record.output_dir)
          await add(
            resolve(roots.project, record.output_dir),
            "inference",
            record,
          );
      },
    );
    const visited = new Set<string>();
    async function scanInference(path: string, depth: number): Promise<void> {
      const resolved = await safe(path);
      if (await exists(join(resolved, ".incomplete"))) return;
      if (visited.has(resolved)) return;
      visited.add(resolved);
      if (visited.size > 5000)
        throw new Error(
          "Result discovery reached 5000 folders; narrow TAMPER_STUDIO_RESULTS",
        );
      if (await exists(join(resolved, "inference_out.csv"))) {
        await add(resolved, "inference");
        return;
      }
      if (depth === 0) return;
      await scanChildren(resolved, (child) => scanInference(child, depth - 1));
    }
    for (const root of [
      join(roots.workspace, "inference_results"),
      roots.results,
      ...(roots.legacyResults ? [roots.legacyResults] : []),
    ]) {
      try {
        await scanInference(root, 8);
      } catch (error) {
        warn(root, error);
      }
    }
    runs = found;
    scanned = true;
    return {
      items: [...runs.values()]
        .map(publicRun)
        .sort((a, b) => b.modified.localeCompare(a.modified)),
      roots: allowed,
      warnings,
    };
  }

  async function runById(id: string) {
    if (!scanned) await list();
    const run = runs.get(id);
    if (!run)
      throw new Error("Saved run not found. Refresh the saved results list.");
    await safe(run.directory);
    return run;
  }

  async function collect(path: string) {
    if (!(await exists(path))) return [];
    const rows: ResultRow[] = [];
    for await (const row of csvRows(await safe(path))) {
      if (rows.length >= 20000)
        throw new Error(
          "Summary exceeds 20000 rows; use the paginated artifact browser",
        );
      rows.push(row);
    }
    return rows;
  }

  async function artifacts(run: Run): Promise<Artifact[]> {
    const result: Artifact[] = [];
    const add = (
      filename: string,
      split: SavedArtifact["split"],
      kind: SavedArtifact["kind"],
      label: string,
    ) => {
      result.push({
        id: idFor(filename),
        filename,
        split,
        kind,
        label,
        derived: false,
        path: join(run.directory, filename),
      });
    };
    if (await exists(join(run.directory, "logs/training_log.csv")))
      add("logs/training_log.csv", "training", "history", "Epoch history");
    for (const [split, folder] of [
      ["validation", "val_eval_results"],
      ["test", "eval_results"],
      ["inference", "."],
    ] as const) {
      const training =
        run.kind === "training" || run.kind === "training-legacy";
      if (training === (split === "inference")) continue;
      const directory = join(run.directory, folder);
      const files: string[] = await readdir(directory).catch(() => []);
      for (const file of files.sort()) {
        if (
          file.endsWith(".csv") &&
          (file === "inference_out.csv" ||
            file === "per_csv_summary.csv" ||
            split !== "inference")
        ) {
          add(
            join(folder, file),
            split,
            file === "inference_out.csv" ? "predictions" : "metrics",
            file.replace(/\.csv$/, "").replaceAll("_", " "),
          );
        }
      }
      for (const [subdir, kind] of [
        ["predictions", "predictions"],
        ["threshold_sweeps", "sweep"],
      ] as const) {
        const files = await readdir(join(directory, subdir)).catch(() => []);
        for (const file of files.sort())
          if (/\.csv(\.gz)?$/.test(file))
            add(
              join(folder, subdir, file),
              split,
              kind,
              `${kind === "sweep" ? "Threshold sweep" : "Predictions"} · ${file.replace(/\.csv(\.gz)?$/, "")}`,
            );
      }
      if (
        split === "validation" &&
        !files.includes("checkpoint_summary.csv") &&
        (await exists(join(run.directory, "logs/training_log.csv")))
      ) {
        result.unshift({
          id: "validation-history",
          filename: "logs/training_log.csv",
          label: "Checkpoint summary (from validation history)",
          split,
          kind: "metrics",
          derived: true,
          source: "validation",
        });
      }
      if (
        split === "test" &&
        !files.includes("checkpoint_summary.csv") &&
        files.some((name) => name.endsWith("_results.txt"))
      ) {
        result.unshift({
          id: "legacy-summary",
          filename: "eval_results/*_results.txt",
          label: "Checkpoint summary (from saved reports)",
          split,
          kind: "metrics",
          derived: true,
          source: "legacy",
        });
      }
    }
    return result.sort(
      (a, b) =>
        Number(b.filename.endsWith("checkpoint_summary.csv")) -
        Number(a.filename.endsWith("checkpoint_summary.csv")),
    );
  }

  async function reportMetrics(path: string): Promise<ResultRow> {
    if (!(await exists(path))) return {};
    const text = await textFile(path);
    const names: Record<string, string> = {
      F1: "f1_score",
      F2: "f2_score",
      AUC: "auc_roc",
      FRR: "frr",
      FAR: "far",
      Accuracy: "accuracy",
      Precision: "precision",
      Recall: "recall",
    };
    const result: ResultRow = {};
    for (const match of text.matchAll(
      /^\s*(F1|F2|AUC|FRR|FAR|Accuracy|Precision|Recall):\s*([^\r\n]+)$/gm,
    )) {
      const value = Number(match[2]);
      result[names[match[1]]] = Number.isFinite(value) ? value : null;
    }
    for (const match of text.matchAll(/\b(TP|TN|FP|FN):\s*(\d+)/g))
      result[match[1].toLowerCase()] = Number(match[2]);
    return result;
  }

  async function detail(id: string): Promise<SavedRunDetail> {
    const run = await runById(id);
    const warnings: string[] = [];
    let history: ResultRow[] = [],
      metrics: ResultRow = {};
    try {
      history = await collect(join(run.directory, "logs/training_log.csv"));
    } catch (error) {
      warnings.push((error as Error).message);
    }
    if (run.kind === "inference") {
      try {
        metrics = await reportMetrics(
          join(run.directory, "inference_out_eval_results.txt"),
        );
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }
    return {
      run: publicRun(run),
      history,
      metrics,
      warnings,
      artifacts: (await artifacts(run)).map(
        ({ path: _path, source: _source, ...value }) => value,
      ),
    };
  }

  async function checkpoints(): Promise<{ items: SavedCheckpoint[] }> {
    await list();
    const items: SavedCheckpoint[] = [];
    for (const run of runs.values()) {
      if (run.kind !== "training" && run.kind !== "training-legacy") continue;
      const configPath = join(run.directory, "config.yaml");
      if (!(await exists(configPath))) continue;
      const directory = join(run.directory, "checkpoints");
      const files = await readdir(directory, { withFileTypes: true }).catch(
        () => [],
      );
      for (const file of files) {
        if (!file.isFile() || !/\.(pth|pt)$/.test(file.name)) continue;
        const checkpointPath = await safe(join(directory, file.name));
        items.push({
          id: idFor(checkpointPath),
          run_id: run.id,
          run_name: run.name,
          run_kind: run.kind,
          name: file.name,
          checkpoint_path: checkpointPath,
          config_path: await safe(configPath),
          size_bytes: (await stat(checkpointPath)).size,
        });
      }
    }
    const checkpointNumber = (name: string) => {
      const match = name.match(/(\d+)\.(?:pth|pt)$/i);
      return match ? Number(match[1]) : -1;
    };
    return {
      items: items.sort(
        (a, b) =>
          a.run_name.localeCompare(b.run_name) ||
          checkpointNumber(b.name) - checkpointNumber(a.name) ||
          b.name.localeCompare(a.name),
      ),
    };
  }

  async function* rowsFor(
    run: Run,
    artifact: Artifact,
  ): AsyncGenerator<ResultRow> {
    if (artifact.path) {
      yield* csvRows(await safe(artifact.path));
      return;
    }
    if (artifact.source === "validation") {
      const mapping: Record<string, string> = {
        val_accuracy: "accuracy",
        val_precision: "precision",
        val_recall: "recall",
        val_f1: "f1_score",
        val_f2: "f2_score",
        val_auc: "auc_roc",
        val_far: "far",
        val_frr: "frr",
      };
      for (const row of await collect(
        join(run.directory, "logs/training_log.csv"),
      )) {
        if (typeof row.epoch !== "number") continue;
        yield {
          checkpoint: `epoch_${row.epoch}`,
          epoch: row.epoch,
          ...Object.fromEntries(
            Object.entries(mapping).map(([from, to]) => [
              to,
              row[from] ?? null,
            ]),
          ),
        };
      }
    } else {
      for (const file of (
        await readdir(join(run.directory, "eval_results"))
      ).sort()) {
        if (file.endsWith("_results.txt"))
          yield {
            checkpoint: file.replace(/_results\.txt$/, ""),
            ...(await reportMetrics(join(run.directory, "eval_results", file))),
          };
      }
    }
  }

  function predictionRow(row: ResultRow, run: Run): ResultRow {
    const label = (value: unknown) => {
      const normalized = String(value ?? "")
        .trim()
        .toLowerCase();
      return ["tampered", "tamper", "1"].includes(normalized)
        ? "tamper"
        : ["genuine", "0"].includes(normalized)
          ? "genuine"
          : "";
    };
    const truth = label(
      row.ground_truth || row.fraud_type || run.metadata.default_label,
    );
    const prediction = label(row.prediction);
    const outcome = !prediction
      ? "Failed"
      : !truth
        ? "Unlabeled"
        : truth === prediction
          ? "Correct"
          : truth === "tamper"
            ? "False acceptance"
            : "False rejection";
    const extra: ResultRow = {};
    if (typeof row.metadata_json === "string") {
      try {
        const value = JSON.parse(row.metadata_json);
        if (value && typeof value === "object" && !Array.isArray(value))
          for (const [key, entry] of Object.entries(value))
            extra[`metadata_${key}`] =
              typeof entry === "object"
                ? JSON.stringify(entry)
                : String(entry ?? "");
      } catch {
        /* Preserve malformed metadata_json in the original column. */
      }
    }
    return {
      ...row,
      ...extra,
      ground_truth: truth || null,
      card_type: row.card_type || String(run.metadata.card_type || ""),
      outcome,
    };
  }

  async function table(
    id: string,
    artifactId: string,
    query: URLSearchParams,
  ): Promise<SavedTable> {
    const run = await runById(id);
    const artifact = (await artifacts(run)).find(
      (item) => item.id === artifactId,
    );
    if (!artifact)
      throw new Error("Saved artifact not found. Refresh the run.");
    const integer = (key: string, fallback: number, maximum: number) => {
      const value = query.get(key);
      if (value === null) return fallback;
      if (!/^\d+$/.test(value) || Number(value) > maximum)
        throw new Error(`Invalid ${key}`);
      return Number(value);
    };
    const offset = integer("offset", 0, 100000000),
      limit = Math.max(1, integer("limit", 50, 200));
    const search = (query.get("q") || "").toLowerCase();
    const outcome = query.get("outcome"),
      card = query.get("card_type");
    const columns = new Set<string>(),
      items: ResultRow[] = [];
    let total = 0,
      unfiltered = 0;
    for await (const raw of rowsFor(run, artifact)) {
      const row =
        artifact.kind === "predictions" ? predictionRow(raw, run) : raw;
      Object.keys(row).forEach((key) => columns.add(key));
      unfiltered++;
      if (
        search &&
        !Object.values(row).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(search),
        )
      )
        continue;
      if (
        (outcome && row.outcome !== outcome) ||
        (card && row.card_type !== card)
      )
        continue;
      if (total >= offset && items.length < limit) items.push(row);
      total++;
    }
    return { items, columns: [...columns], total, unfiltered, offset, limit };
  }

  async function downloadPath(id: string, artifactId: string) {
    const run = await runById(id);
    const artifact = (await artifacts(run)).find(
      (item) => item.id === artifactId,
    );
    if (!artifact?.path)
      throw new Error(
        "This view is derived from saved files and has no standalone download",
      );
    return safe(artifact.path);
  }

  async function epochs(id: string): Promise<EpochList> {
    const run = await runById(id);
    const available = await artifacts(run);
    const warnings: string[] = [];
    const records = new Map<string, EpochRecord>();
    let history: ResultRow[] = [];
    try {
      history = await collect(join(run.directory, "logs/training_log.csv"));
    } catch (error) {
      warnings.push((error as Error).message);
    }
    const ensure = (
      split: "validation" | "test",
      checkpoint: string,
      epoch?: unknown,
    ) => {
      const key = `${split}:${checkpoint}`;
      let entry = records.get(key);
      if (!entry) {
        const candidate = epoch ?? /^epoch_(\d+)$/.exec(checkpoint)?.[1];
        const number =
          candidate == null || candidate === "" ? null : Number(candidate);
        entry = {
          checkpoint,
          split,
          epoch: number !== null && Number.isFinite(number) ? number : null,
          metrics: {},
          metric_source: "",
          history: [],
          datasets: [],
          predictions: [],
        };
        records.set(key, entry);
      } else if (
        entry.epoch === null &&
        epoch != null &&
        epoch !== "" &&
        Number.isFinite(Number(epoch))
      ) {
        entry.epoch = Number(epoch);
      }
      return entry;
    };
    for (const row of history) {
      if (row.epoch == null) continue;
      const entry = ensure("validation", `epoch_${row.epoch}`, row.epoch);
      const fields: Record<string, string> = {
        val_accuracy: "accuracy",
        val_precision: "precision",
        val_recall: "recall",
        val_f1: "f1_score",
        val_f2: "f2_score",
        val_auc: "auc_roc",
        val_far: "far",
        val_frr: "frr",
      };
      entry.metrics = Object.fromEntries(
        Object.entries(fields).map(([from, to]) => [to, row[from] ?? null]),
      );
      entry.metric_source = "Training history";
    }
    for (const artifact of available) {
      if (artifact.split !== "validation" && artifact.split !== "test")
        continue;
      if (artifact.kind === "predictions") {
        const checkpoint = checkpointName(
          basename(artifact.filename).replace(/\.csv(\.gz)?$/, ""),
        );
        const { path: _path, source: _source, ...publicArtifact } = artifact;
        ensure(artifact.split, checkpoint).predictions.push(publicArtifact);
        continue;
      }
      const perDataset = artifact.filename.endsWith("per_csv_summary.csv");
      if (
        !perDataset &&
        !artifact.filename.endsWith("checkpoint_summary.csv") &&
        artifact.source !== "legacy"
      )
        continue;
      try {
        let count = 0;
        for await (const row of rowsFor(run, artifact)) {
          if (++count > 20000)
            throw new Error("Epoch summary exceeds 20000 rows");
          const checkpoint = checkpointName(
            row.checkpoint || (row.epoch != null ? `epoch_${row.epoch}` : ""),
          );
          if (!checkpoint) continue;
          const entry = ensure(artifact.split, checkpoint, row.epoch);
          if (perDataset) entry.datasets.push(row);
          else {
            entry.metrics = row;
            entry.metric_source = artifact.label;
          }
        }
      } catch (error) {
        warnings.push(`${artifact.label}: ${(error as Error).message}`);
      }
    }
    for (const entry of records.values())
      entry.history = history.filter(
        (row) => entry.epoch !== null && Number(row.epoch) === entry.epoch,
      );
    return {
      items: [...records.values()].sort(
        (a, b) =>
          (a.epoch ?? Infinity) - (b.epoch ?? Infinity) ||
          a.checkpoint.localeCompare(b.checkpoint),
      ),
      warnings,
    };
  }

  async function performance(id: string, artifactId: string) {
    const run = await runById(id);
    const artifact = (await artifacts(run)).find(
      (item) =>
        item.id === artifactId &&
        item.kind === "predictions" &&
        (item.split === "validation" || item.split === "test"),
    );
    if (!artifact)
      throw new Error("Saved training predictions not found. Refresh the run.");
    const checkpoint = checkpointName(
      basename(artifact.filename).replace(/\.csv(\.gz)?$/, ""),
    );
    return cardPerformance(rowsFor(run, artifact), checkpoint, artifact.split);
  }

  async function distribution(id: string) {
    const run = await runById(id);
    return readDatasetDistribution(run.directory, safe);
  }

  return {
    list,
    detail,
    checkpoints,
    table,
    downloadPath,
    distribution,
    epochs,
    performance,
  };
}
