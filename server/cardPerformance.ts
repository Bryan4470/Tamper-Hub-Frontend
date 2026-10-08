import type { CardPerformance, ResultRow } from "../src/api/studioTypes.ts";

export function checkpointName(value: unknown): string {
  return String(value ?? "").replace(/\.pth$/, "");
}

function numeric(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function binary(value: unknown): number | null {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["genuine", "real", "0"].includes(text)) return 0;
  if (["tamper", "tampered", "1"].includes(text)) return 1;
  return null;
}

type Group = {
  num_samples: number;
  evaluated: number;
  excluded: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  thresholds: Set<number>;
  scores: { score: number; truth: number }[];
};
const group = (): Group => ({
  num_samples: 0,
  evaluated: 0,
  excluded: 0,
  tp: 0,
  tn: 0,
  fp: 0,
  fn: 0,
  thresholds: new Set(),
  scores: [],
});
const ratio = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : null;

function metrics(value: Group): ResultRow {
  const { tp, tn, fp, fn, evaluated, excluded, num_samples } = value;
  const scores = value.scores.sort((a, b) => a.score - b.score);
  let positive = 0,
    negative = 0,
    favorablePairs = 0;
  for (let start = 0; start < scores.length;) {
    let end = start,
      positives = 0;
    while (end < scores.length && scores[end].score === scores[start].score) {
      positives += scores[end].truth;
      end++;
    }
    const negatives = end - start - positives;
    favorablePairs += positives * (negative + negatives / 2);
    positive += positives;
    negative += negatives;
    start = end;
  }
  return {
    num_samples,
    evaluated,
    excluded,
    num_genuine: tn + fp,
    num_tamper: tp + fn,
    tp,
    tn,
    fp,
    fn,
    threshold: [...value.thresholds].sort((a, b) => a - b).join(", ") || null,
    accuracy: ratio(tp + tn, evaluated),
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    far: ratio(fn, tp + fn),
    frr: ratio(fp, tn + fp),
    f1_score: ratio(2 * tp, 2 * tp + fp + fn),
    f2_score: ratio(5 * tp, 5 * tp + fp + 4 * fn),
    // Do not silently report AUC from only the rows that happened to save scores.
    auc_roc:
      scores.length === evaluated
        ? ratio(favorablePairs, positive * negative)
        : null,
    scored_samples: scores.length,
  };
}

export async function cardPerformance(
  rows: AsyncIterable<ResultRow>,
  checkpoint: string,
  split: string,
): Promise<CardPerformance> {
  const overall = group();
  const groups = new Map<string, Group>();
  let mismatched = 0;
  for await (const row of rows) {
    const rowSplit = String(row.split || "").toLowerCase();
    if (
      (row.checkpoint && checkpointName(row.checkpoint) !== checkpoint) ||
      (rowSplit && (rowSplit === "val" ? "validation" : rowSplit) !== split)
    ) {
      mismatched++;
      continue;
    }
    const card =
      String(row.card_type || "unknown")
        .trim()
        .toLowerCase() || "unknown";
    const value = groups.get(card) || group();
    groups.set(card, value);
    const truth =
      binary(row.ground_truth) ??
      binary(row.ground_truth_index) ??
      binary(row.fraud_type);
    const savedPrediction =
      binary(row.prediction) ?? binary(row.prediction_index);
    const rawScore = numeric(row.prob_tampered);
    const score =
      rawScore !== null && rawScore >= 0 && rawScore <= 1 ? rawScore : null;
    const rawThreshold = numeric(row.threshold);
    const threshold =
      rawThreshold !== null && rawThreshold >= 0 && rawThreshold <= 1
        ? rawThreshold
        : null;
    const prediction =
      savedPrediction ??
      (score !== null && threshold !== null
        ? Number(score >= threshold)
        : null);
    for (const target of [overall, value]) {
      target.num_samples++;
      if (truth === null || prediction === null) {
        target.excluded++;
        continue;
      }
      target.evaluated++;
      if (threshold !== null) target.thresholds.add(threshold);
      if (truth === 1) {
        if (prediction === 1) target.tp++;
        else target.fn++;
      } else {
        if (prediction === 1) target.fp++;
        else target.tn++;
      }
      if (score !== null) target.scores.push({ score, truth });
    }
  }
  return {
    overall: metrics(overall),
    cards: [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([card_type, value]) => ({ card_type, ...metrics(value) })),
    warnings: mismatched
      ? [
          `Excluded ${mismatched} rows belonging to a different checkpoint or split.`,
        ]
      : [],
  };
}
