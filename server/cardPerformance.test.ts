import assert from "node:assert/strict";
import { test } from "node:test";
import { cardPerformance } from "./cardPerformance.ts";
import type { ResultRow } from "../src/api/studioTypes.ts";
async function* rows(values: ResultRow[]) {
  yield* values;
}

test("per-card rates use full confusion counts and tie-aware ROC AUC", async () => {
  const result = await cardPerformance(
    rows([
      {
        card_type: "mykadfront",
        ground_truth: "tamper",
        prediction: "tamper",
        prob_tampered: 0.9,
        threshold: 0.5,
      },
      {
        card_type: "mykadfront",
        ground_truth: "tamper",
        prediction: "genuine",
        prob_tampered: 0.3,
        threshold: 0.5,
      },
      {
        card_type: "mykadfront",
        ground_truth: "genuine",
        prediction: "tamper",
        prob_tampered: 0.7,
        threshold: 0.5,
      },
      {
        card_type: "mykadfront",
        ground_truth: "genuine",
        prediction: "genuine",
        prob_tampered: 0.3,
        threshold: 0.5,
      },
      {
        card_type: "mykadback_2026",
        ground_truth_index: 1,
        prob_tampered: 0.7,
        threshold: 0.8,
      },
    ]),
    "epoch_1",
    "validation",
  );
  const front = result.cards.find((row) => row.card_type === "mykadfront")!;
  for (const key of [
    "accuracy",
    "precision",
    "recall",
    "far",
    "frr",
    "f1_score",
    "f2_score",
  ])
    assert.equal(front[key], 0.5, key);
  assert.equal(front.auc_roc, 0.625);
  assert.equal(front.tp, 1);
  assert.equal(front.tn, 1);
  assert.equal(front.fp, 1);
  assert.equal(front.fn, 1);
  const back = result.cards.find((row) => row.card_type === "mykadback_2026")!;
  assert.equal(back.far, 1);
  assert.equal(back.frr, null);
  assert.equal(back.auc_roc, null);
  assert.equal(result.overall.far, 2 / 3);
  assert.equal(result.overall.f2_score, 5 / 14);
});

test("missing labels, probabilities and denominators remain unavailable; unrelated rows cannot leak", async () => {
  const result = await cardPerformance(
    rows([
      {
        checkpoint: "epoch_1.pth",
        split: "val",
        ground_truth_index: 0,
        prediction_index: 0,
      },
      { ground_truth: "tamper", prediction: "tamper", prob_tampered: 0.8 },
      { ground_truth: "", prediction: "genuine", confidence: 0.9 },
      { ground_truth: "tamper", prediction: "", confidence: 0.9 },
      { checkpoint: "epoch_2", ground_truth: "tamper", prediction: "genuine" },
      { split: "test", ground_truth: "tamper", prediction: "genuine" },
    ]),
    "epoch_1",
    "validation",
  );
  assert.equal(result.overall.num_samples, 4);
  assert.equal(result.overall.evaluated, 2);
  assert.equal(result.overall.excluded, 2);
  assert.equal(result.overall.accuracy, 1);
  assert.equal(result.overall.auc_roc, null);
  assert.equal(result.cards[0].card_type, "unknown");
  assert.match(result.warnings[0], /Excluded 2 rows/);
  const empty = await cardPerformance(rows([]), "epoch_1", "test");
  assert.equal(empty.overall.accuracy, null);
  assert.equal(empty.overall.f1_score, null);
});

test("per-CSV metrics preserve full source paths, duplicates and epoch/split isolation", async () => {
  const result = await cardPerformance(
    rows([
      {
        source_csv: "/front/shared.csv",
        ground_truth: "tamper",
        prediction: "genuine",
        checkpoint: "epoch_2",
        split: "val",
      },
      {
        source_csv: "/front/shared.csv",
        ground_truth: "tamper",
        prediction: "genuine",
        checkpoint: "epoch_2",
        split: "val",
      },
      {
        source_csv: "/back/shared.csv",
        ground_truth: "genuine",
        prediction: "genuine",
      },
      { source_csv: "/back/shared.csv", ground_truth: "genuine" },
      {
        source_csv: "/wrong.csv",
        ground_truth: "tamper",
        prediction: "tamper",
        checkpoint: "epoch_1",
      },
      {
        source_csv: "/wrong.csv",
        ground_truth: "tamper",
        prediction: "tamper",
        split: "test",
      },
    ]),
    "epoch_2",
    "validation",
  );
  assert.equal(result.datasets?.length, 2);
  const front = result.datasets!.find(
    (row) => row.csv === "/front/shared.csv",
  )!;
  assert.equal(front.num_samples, 2);
  assert.equal(front.fn, 2);
  assert.equal(front.far, 1);
  assert.equal(front.frr, null);
  const back = result.datasets!.find((row) => row.csv === "/back/shared.csv")!;
  assert.equal(back.tn, 1);
  assert.equal(back.excluded, 1);
  assert.equal(back.auc_roc, null);
});

test("test manifests use preserved original CSV provenance", async () => {
  const result = await cardPerformance(
    rows([
      {
        source_csv: "/submissions/test.csv",
        metadata_json: JSON.stringify({
          source_csv: "/datasets/mykadfront/genuine/a.csv",
        }),
        ground_truth: "genuine",
        prediction: "genuine",
      },
      {
        source_csv: "/submissions/test.csv",
        metadata_source_csv: "/datasets/mykadback/tamper/b.csv",
        ground_truth: "tamper",
        prediction: "genuine",
      },
    ]),
    "epoch_1",
    "test",
  );
  assert.deepEqual(
    result.datasets!.map((row) => row.csv),
    ["/datasets/mykadback/tamper/b.csv", "/datasets/mykadfront/genuine/a.csv"],
  );
  assert.equal(result.datasets![0].far, 1);
});
