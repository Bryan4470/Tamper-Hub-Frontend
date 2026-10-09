import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { gzipSync } from "node:zlib";
import { createStudioReader, studioRoots } from "./studio.ts";
import { csvRows } from "./csv.ts";
import { studioMiddleware } from "./middleware.ts";

test("uses the mounted checkpoint directory by default", () => {
  const roots = studioRoots({ TAMPER_STUDIO_PROJECT: "/tmp/tamper-project" });
  assert.equal(roots.results, "/mnt5/dataset/tamper/tamper_hub/results");
  assert.equal(roots.legacyResults, "/tmp/tamper-project/results");
  assert.equal(roots.checkpoints, "/mnt5/dataset/tamper/checkpoints");
  assert.equal(roots.legacyCheckpoints, "/tmp/tamper-project/checkpoints");
});

async function fixture(t: TestContext) {
  const project = await mkdtemp(join(tmpdir(), "tamper-results-"));
  t.after(() => rm(project, { recursive: true, force: true }));
  const roots = {
    project,
    checkpoints: join(project, "checkpoints"),
    legacyCheckpoints: join(project, "legacy-checkpoints"),
    workspace: join(project, "workspace"),
    results: join(project, "results"),
  };
  for (const path of [
    roots.checkpoints,
    roots.legacyCheckpoints,
    roots.results,
    ...["runs", "inference_jobs", "inference_results"].map((name) =>
      join(roots.workspace, name),
    ),
  ])
    await mkdir(path, { recursive: true });
  const put = async (path: string, value: string | Buffer) => {
    const dest = join(project, path);
    await mkdir(join(dest, ".."), { recursive: true });
    await writeFile(dest, value);
    return dest;
  };
  const reader = createStudioReader(roots);
  return { roots, put, reader };
}

test("discovers training and inference, deduplicates registry paths, preserves failed status", async (t) => {
  const { roots, put, reader } = await fixture(t);
  await put("checkpoints/run/config.yaml", "training: {}\n");
  await put(
    "checkpoints/run/studio_metadata.json",
    JSON.stringify({
      name: "My training",
      status: "failed",
      error: "interrupted",
    }),
  );
  await put("legacy-checkpoints/old-run/config.yaml", "training: {}\n");
  await put("legacy-checkpoints/old-run/checkpoints/epoch_7.pth", "weights");
  await put("legacy-checkpoints/old-run/checkpoints/epoch_21.pth", "weights");
  await put("legacy-checkpoints/old-run/checkpoints/epoch_3.pth", "weights");
  await put(
    "workspace/runs/one/run.json",
    JSON.stringify({ artifact_dir: join(roots.checkpoints, "run") }),
  );
  await put(
    "workspace/inference_results/one/inference_out.csv",
    "prediction\ngenuine\n",
  );
  await put(
    "workspace/inference_jobs/job/job.json",
    JSON.stringify({
      output_dir: join(roots.workspace, "inference_results/one"),
      name: "Saved inference",
      status: "completed",
    }),
  );
  await put("results/nested/deep/inference_out.csv", "prediction\ntampered\n");
  const list = await reader.list();
  assert.equal(list.items.length, 4);
  assert.deepEqual(list.warnings, []);
  assert.equal(
    list.items.find((row) => row.kind === "training")?.status,
    "failed",
  );
  assert.ok(list.items.some((row) => row.name === "Saved inference"));
  assert.equal(
    list.items.find((row) => row.name === "old-run")?.kind,
    "training-legacy",
  );
  const checkpoints = await reader.checkpoints();
  assert.equal(checkpoints.items.length, 3);
  assert.deepEqual(
    checkpoints.items.map((checkpoint) => checkpoint.name),
    ["epoch_21.pth", "epoch_7.pth", "epoch_3.pth"],
  );
  assert.equal(checkpoints.items[0].run_kind, "training-legacy");
  assert.equal(
    checkpoints.items[0].config_path,
    join(roots.legacyCheckpoints, "old-run/config.yaml"),
  );
});

test("reads test and validation separately, falls back to history and old reports", async (t) => {
  const { put, reader } = await fixture(t);
  await put(
    "checkpoints/run/logs/training_log.csv",
    "epoch,train_loss,val_loss,val_f1,val_far,val_frr\n1,0.2,0.3,0.91,0.02,\n",
  );
  await put(
    "checkpoints/run/eval_results/epoch_1_results.txt",
    "F1: 0.82\nFAR: 0.08\nFRR: 0.05\nTP: 92, TN: 95, FP: 5, FN: 8\n",
  );
  const run = (await reader.list()).items[0];
  const detail = await reader.detail(run.id);
  assert.equal(detail.history.length, 1);
  const validation = await reader.table(
    run.id,
    "validation-history",
    new URLSearchParams(),
  );
  assert.equal(validation.items[0].far, 0.02);
  assert.equal(validation.items[0].frr, null);
  assert.equal(validation.items[0].f2_score, null);
  const testRows = await reader.table(
    run.id,
    "legacy-summary",
    new URLSearchParams(),
  );
  assert.equal(testRows.items[0].far, 0.08);
  assert.equal(testRows.items[0].fn, 8);
  await put(
    "checkpoints/run/val_eval_results/checkpoint_summary.csv",
    "checkpoint,far\nepoch_1,0.01\n",
  );
  const fresh = await reader.detail(run.id);
  assert.ok(!fresh.artifacts.some((a) => a.id === "validation-history"));
  const saved = fresh.artifacts.find((a) => a.split === "validation")!;
  assert.equal(
    (await reader.table(run.id, saved.id, new URLSearchParams())).items[0].far,
    0.01,
  );
});

test("streams quoted UTF-8 CSV and gzip; pagination and filters apply to the full file", async (t) => {
  const { put, reader } = await fixture(t);
  await put("checkpoints/run/config.yaml", "{}");
  const csv =
    "\uFEFFsample_id,image_path,ground_truth,prediction,prob_tampered,metadata_json\r\n" +
    Array.from(
      { length: 55 },
      (_, i) =>
        `${i},"/data/卡,${i}.jpg",tampered,genuine,0.2,"{""note"":""line\\nquoted""}"`,
    ).join("\r\n") +
    '\r\n55,"/data/multi\nline.jpg",genuine,tampered,0.8,{}\r\n';
  const path = await put(
    "checkpoints/run/eval_results/predictions/epoch_1.csv.gz",
    gzipSync(csv),
  );
  const run = (await reader.list()).items[0];
  const artifact = (await reader.detail(run.id)).artifacts[0];
  const first = await reader.table(
    run.id,
    artifact.id,
    new URLSearchParams("limit=50"),
  );
  assert.equal(first.total, 56);
  assert.equal(first.items.length, 50);
  assert.equal(first.items[0].image_path, "/data/卡,0.jpg");
  assert.equal(first.items[0].outcome, "False acceptance");
  assert.equal(first.items[0].metadata_note, "line\nquoted");
  const next = await reader.table(
    run.id,
    artifact.id,
    new URLSearchParams("offset=50&limit=50"),
  );
  assert.equal(next.items.length, 6);
  assert.equal(next.items[5].image_path, "/data/multi\nline.jpg");
  const errors = await reader.table(
    run.id,
    artifact.id,
    new URLSearchParams("outcome=False+rejection"),
  );
  assert.equal(errors.total, 1);
  assert.equal(errors.unfiltered, 56);
  assert.equal(await reader.downloadPath(run.id, artifact.id), path);
});

test("legacy prediction defaults preserve missing labels and confidence semantics", async (t) => {
  const { roots, put, reader } = await fixture(t);
  await put(
    "workspace/inference_results/run/inference_out.csv",
    "prediction,confidence,prob_tampered\ngenuine,0.2,0.2\nerror,,\n",
  );
  const run = (await reader.list()).items[0];
  const artifact = (await reader.detail(run.id)).artifacts[0];
  let rows = await reader.table(run.id, artifact.id, new URLSearchParams());
  assert.equal(rows.items[0].outcome, "Unlabeled");
  assert.equal(rows.items[0].confidence, 0.2);
  assert.equal(rows.items[1].outcome, "Failed");
  assert.equal(rows.items[1].prob_tampered, null);
  await put(
    "workspace/inference_jobs/job/job.json",
    JSON.stringify({
      output_dir: join(roots.workspace, "inference_results/run"),
      default_label: "tamper",
      card_type: "mykadback",
    }),
  );
  await reader.list();
  rows = await reader.table(
    run.id,
    artifact.id,
    new URLSearchParams("card_type=mykadback"),
  );
  assert.equal(rows.items[0].outcome, "False acceptance");
});

test("rejects path escapes, symlinked artifact escapes, unknown artifacts and invalid pagination", async (t) => {
  const { roots, put, reader } = await fixture(t);
  const outside = await put("outside/config.yaml", "private");
  await symlink(
    join(roots.project, "outside"),
    join(roots.checkpoints, "escaped"),
  );
  await put("checkpoints/run/config.yaml", "{}");
  await mkdir(join(roots.checkpoints, "run/eval_results"));
  await symlink(
    outside,
    join(roots.checkpoints, "run/eval_results/checkpoint_summary.csv"),
  );
  const list = await reader.list();
  assert.equal(list.items.length, 1);
  assert.ok(
    list.warnings.some((warning) => warning.includes("outside the configured")),
  );
  const id = list.items[0].id;
  const artifact = (await reader.detail(id)).artifacts[0];
  await assert.rejects(
    reader.downloadPath(id, artifact.id),
    /outside the configured/,
  );
  await assert.rejects(
    reader.table(id, "../../outside", new URLSearchParams()),
    /not found/,
  );
  await assert.rejects(
    reader.table(id, artifact.id, new URLSearchParams("offset=-1")),
    /Invalid offset/,
  );
  await assert.rejects(
    reader.table(id, artifact.id, new URLSearchParams("limit=201")),
    /Invalid limit/,
  );
});

test("malformed CSVs are errors, not silently missing or zero metrics", async (t) => {
  const { put } = await fixture(t);
  for (const [name, value, message] of [
    ["quote", 'epoch,val_far\n1,"0.5', /Incomplete quoted/],
    ["ragged", "epoch,val_far\n1,0.1,extra", /does not match/],
  ] as const) {
    const path = await put(`${name}.csv`, value);
    await assert.rejects(async () => {
      for await (const row of csvRows(path)) void row;
    }, message);
  }
});

test("HTTP reader is read-only, blocks foreign origins, and downloads exact CSV bytes", async (t) => {
  const { put, reader } = await fixture(t);
  const file = await put(
    "results/run/inference_out.csv",
    "prediction,prob_tampered\ngenuine,0.1\n",
  );
  const middleware = studioMiddleware(reader);
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/studio-api/v1/runs`;
  assert.equal((await fetch(base, { method: "POST" })).status, 405);
  assert.equal(
    (await fetch(base, { headers: { Origin: "https://other.invalid" } }))
      .status,
    403,
  );
  assert.equal((await fetch(base + "/../../etc/passwd")).status, 404);
  const list = await (await fetch(base)).json();
  const detail = await (await fetch(`${base}/${list.items[0].id}`)).json();
  const download = await fetch(
    `${base}/${list.items[0].id}/download?artifact=${detail.artifacts[0].id}`,
  );
  assert.equal(download.status, 200);
  assert.ok(
    download.headers.get("content-disposition")?.includes("attachment"),
  );
  assert.equal(await download.text(), await readFile(file, "utf8"));
});

test("does not list incomplete inference exports", async (t) => {
  const { put, reader } = await fixture(t);
  await put(
    "results/incomplete/inference_out.csv",
    "image_path,prediction\na.jpg,genuine\n",
  );
  await put("results/incomplete/.incomplete", "");
  await put(
    "results/complete/inference_out.csv",
    "image_path,prediction\na.jpg,genuine\n",
  );
  const runs = (await reader.list()).items.filter(
    (run) => run.kind === "inference",
  );
  assert.equal(runs.length, 1);
  assert.equal(runs[0].name, "complete");
});

test("discovers both current and legacy result folders", async (t) => {
  const { roots, put } = await fixture(t);
  await put("results/new/inference_out.csv", "prediction\ngenuine\n");
  await put("legacy-results/old/inference_out.csv", "prediction\ntampered\n");
  const reader = createStudioReader({
    ...roots,
    legacyResults: join(roots.project, "legacy-results"),
  });
  assert.equal((await reader.list()).items.length, 2);
});

test("dataset distribution uses saved splits, normalizes labels, and detects overlap", async (t) => {
  const { put, reader } = await fixture(t);
  await put("checkpoints/run/config.yaml", "training: {}\n");
  await put(
    "checkpoints/run/dataset/train.csv",
    "image_path,fraud_type,card_type,camera\n/a,real,mykadfront,phone\n/a,genuine,mykadfront,phone\n/b,tampered,mykadback,scanner\n",
  );
  await put(
    "checkpoints/run/dataset/val.csv",
    "image_path,fraud_type,card_type,camera\n/a,genuine,mykadfront,phone\n",
  );
  await put(
    "checkpoints/run/dataset/source_csvs.csv",
    "path,rows\n/source.csv,4\n",
  );
  const run = (await reader.list()).items[0];
  const data = await reader.distribution(run.id);
  assert.equal(data.total, 4);
  assert.equal(data.unique_images, 2);
  assert.equal(data.cross_split_images, 1);
  assert.equal(data.duplicate_rows, 1);
  assert.deepEqual(data.splits, [
    { split: "Train", samples: 3, genuine: 2, tamper: 1 },
    { split: "Validation", samples: 1, genuine: 1, tamper: 0 },
  ]);
  assert.deepEqual(data.counts.camera[0], {
    split: "Train",
    value: "phone",
    samples: 2,
  });
  assert.equal(data.sources.length, 1);
  assert.deepEqual(data.warnings, []);
});

test("dataset distribution handles legacy missing manifests and rejects symlink escapes", async (t) => {
  const { roots, put, reader } = await fixture(t);
  await put("checkpoints/run/config.yaml", "training: {}\n");
  const run = (await reader.list()).items[0];
  assert.equal((await reader.distribution(run.id)).total, 0);
  await put("outside.csv", "image_path,fraud_type\n/private,genuine\n");
  await mkdir(join(roots.checkpoints, "run/dataset"));
  await symlink(
    join(roots.project, "outside.csv"),
    join(roots.checkpoints, "run/dataset/train.csv"),
  );
  const data = await reader.distribution(run.id);
  assert.equal(data.total, 0);
  assert.match(data.warnings[0], /outside the configured Studio roots/);
});

test("epoch details isolate split and checkpoint, attach history and datasets, and aggregate full predictions", async (t) => {
  const { put, reader } = await fixture(t);
  await put(
    "checkpoints/run/logs/training_log.csv",
    "epoch,train_loss,val_loss,val_far\n1,0.2,0.3,0.1\n2,0.1,0.2,0.05\n",
  );
  await put(
    "checkpoints/run/val_eval_results/checkpoint_summary.csv",
    "checkpoint,epoch,far\nepoch_1,1,0.02\nepoch_2,2,0.01\n",
  );
  await put(
    "checkpoints/run/eval_results/checkpoint_summary.csv",
    "checkpoint,epoch,far\nepoch_1,1,0.2\nbest_auc,2,0.03\n",
  );
  await put(
    "checkpoints/run/eval_results/per_csv_summary.csv",
    "checkpoint,epoch,csv,far\nepoch_1,1,first.csv,0.2\nbest_auc,2,second.csv,0.03\n",
  );
  const predictionPath =
    "checkpoints/run/eval_results/predictions/epoch_1.csv.gz";
  await put(
    predictionPath,
    gzipSync(
      "checkpoint,epoch,split,card_type,ground_truth,prediction,prob_tampered,threshold\n" +
        Array.from(
          { length: 60 },
          (_, i) =>
            `epoch_1,1,test,mykadfront,${i < 30 ? "tamper,tamper,0.8" : "genuine,genuine,0.2"},0.5\n`,
        ).join(""),
    ),
  );
  const run = (await reader.list()).items[0];
  const epochs = await reader.epochs(run.id);
  assert.deepEqual(epochs.warnings, []);
  const validation = epochs.items.find(
    (item) => item.checkpoint === "epoch_1" && item.split === "validation",
  )!;
  const testEpoch = epochs.items.find(
    (item) => item.checkpoint === "epoch_1" && item.split === "test",
  )!;
  assert.equal(validation.metrics.far, 0.02);
  assert.equal(testEpoch.metrics.far, 0.2);
  assert.equal(testEpoch.history[0].val_far, 0.1);
  assert.equal(testEpoch.datasets.length, 1);
  assert.equal(testEpoch.datasets[0].csv, "first.csv");
  assert.equal(validation.predictions.length, 0);
  const best = epochs.items.find((item) => item.checkpoint === "best_auc")!;
  assert.equal(best.epoch, 2);
  assert.equal(best.history[0].epoch, 2);
  assert.equal(best.datasets[0].csv, "second.csv");
  const performance = await reader.performance(
    run.id,
    testEpoch.predictions[0].id,
  );
  assert.equal(performance.overall.num_samples, 60);
  assert.equal(performance.overall.auc_roc, 1);
  assert.equal(performance.cards[0].far, 0);
  assert.equal(performance.cards[0].num_genuine, 30);
  await assert.rejects(
    reader.performance(run.id, "validation-history"),
    /not found/,
  );
});

test("legacy epoch text reports retain checkpoint metrics without inventing card metrics", async (t) => {
  const { put, reader } = await fixture(t);
  await put("checkpoints/old/config.yaml", "{}\n");
  await put(
    "checkpoints/old/eval_results/epoch_7_results.txt",
    "FAR: 0.12\nTP: 88, TN: 90, FP: 10, FN: 12\n",
  );
  const run = (await reader.list()).items[0];
  const epoch = (await reader.epochs(run.id)).items[0];
  assert.equal(epoch.epoch, 7);
  assert.equal(epoch.split, "test");
  assert.equal(epoch.metrics.far, 0.12);
  assert.equal(epoch.predictions.length, 0);
  assert.deepEqual(epoch.history, []);
});

test("CSV image drilldown matches confusion counts and rejects escaped image paths", async (t) => {
  const { put, reader } = await fixture(t);
  await put("checkpoints/images/config.yaml", "training: {}\n");
  const image = await put(
    "images/card.jpg",
    Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  );
  const bad = await put("images/escape.jpg", "placeholder");
  await rm(bad);
  await symlink("/etc/passwd", bad);
  const values = [
    [image, "/mykadfront/a.csv", "tamper", "tamper", "epoch_1", "test"],
    [image, "/mykadfront/a.csv", "tamper", "genuine", "epoch_1", "test"],
    [image, "/mykadfront/a.csv", "genuine", "tamper", "epoch_1", "test"],
    [image, "/mykadfront/a.csv", "genuine", "genuine", "epoch_1", "test"],
    [image, "/mykadback/a.csv", "tamper", "tamper", "epoch_1", "test"],
    [bad, "/mykadfront/a.csv", "tamper", "tamper", "epoch_2", "test"],
  ];
  await put(
    "checkpoints/images/eval_results/predictions/epoch_1.csv",
    "image_path,source_csv,ground_truth,prediction,checkpoint,split\n" +
      values.map((row) => row.join(",")).join("\n") +
      "\n",
  );
  const run = (await reader.list()).items[0];
  const artifact = (await reader.detail(run.id)).artifacts.find(
    (row) => row.kind === "predictions",
  )!;
  const all = await reader.table(
    run.id,
    artifact.id,
    new URLSearchParams({ source_csv: "/mykadfront/a.csv", limit: "2" }),
  );
  assert.equal(all.total, 4);
  assert.equal(all.items.length, 2);
  assert.equal(all.items[1]._row_index, 1);
  const metrics = await reader.performance(run.id, artifact.id);
  const csv = metrics.datasets!.find((row) => row.csv === "/mykadfront/a.csv")!;
  for (const cell of ["tp", "tn", "fp", "fn"]) {
    const result = await reader.table(
      run.id,
      artifact.id,
      new URLSearchParams({ source_csv: "/mykadfront/a.csv", confusion: cell }),
    );
    assert.equal(result.total, csv[cell]);
    assert.equal(result.items[0].confusion_cell, cell);
  }
  assert.equal(
    (await reader.predictionImage(run.id, artifact.id, "1")).path,
    image,
  );
  await assert.rejects(
    reader.predictionImage(run.id, artifact.id, "5"),
    /outside/,
  );
  await assert.rejects(
    reader.predictionImage(run.id, artifact.id, "-1"),
    /Invalid/,
  );
  await assert.rejects(
    reader.predictionImage(run.id, "unknown", "0"),
    /not found/,
  );
});
