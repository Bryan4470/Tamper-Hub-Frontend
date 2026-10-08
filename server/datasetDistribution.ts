import { join } from "node:path";
import { csvRows } from "./csv.ts";
import type { DatasetDistribution } from "../src/api/studioTypes.ts";

const excluded = new Set([
  "sample_id",
  "image_path",
  "split",
  "metadata_json",
  "source_matches",
]);

export async function readDatasetDistribution(
  directory: string,
  safe: (path: string) => Promise<string>,
): Promise<DatasetDistribution> {
  const result: DatasetDistribution = {
    total: 0,
    unique_images: 0,
    cross_split_images: 0,
    duplicate_rows: 0,
    splits: [],
    counts: {},
    sources: [],
    warnings: [],
  };
  const cardBalance = new Map<
    string,
    {
      split: string;
      card_type: string;
      samples: number;
      genuine: number;
      tamper: number;
      unknown: number;
    }
  >();
  const images = new Map<string, Set<string>>();
  const counts = new Map<
    string,
    Map<string, { split: string; value: string; samples: number }>
  >();
  for (const [filename, split] of [
    ["train", "Train"],
    ["val", "Validation"],
    ["test", "Test"],
  ]) {
    const summary = { split, samples: 0, genuine: 0, tamper: 0 };
    let path: string;
    try {
      path = await safe(join(directory, "dataset", `${filename}.csv`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        result.warnings.push(`${split}: ${(error as Error).message}`);
      continue;
    }
    try {
      for await (const row of csvRows(path)) {
        const image = String(row.image_path ?? "").trim();
        const label = String(row.fraud_type || "unknown")
          .trim()
          .toLowerCase();
        row.fraud_type =
          label === "real"
            ? "genuine"
            : label === "tampered"
              ? "tamper"
              : label;
        row.card_type =
          String(
            row.card_type ??
              (["mykadback_2026", "mykadfront_2026", "mykadback"].find((card) =>
                image.toLowerCase().includes(card),
              ) ||
                "mykadfront"),
          )
            .trim()
            .toLowerCase() || "unknown";
        const balanceKey = JSON.stringify([split, row.card_type]);
        const balance = cardBalance.get(balanceKey) || {
          split,
          card_type: row.card_type,
          samples: 0,
          genuine: 0,
          tamper: 0,
          unknown: 0,
        };
        balance.samples++;
        if (row.fraud_type === "genuine") balance.genuine++;
        else if (row.fraud_type === "tamper") balance.tamper++;
        else balance.unknown++;
        cardBalance.set(balanceKey, balance);
        summary.samples++;
        if (row.fraud_type === "genuine") summary.genuine++;
        if (row.fraud_type === "tamper") summary.tamper++;
        if (image) {
          const splits = images.get(image) || new Set<string>();
          if (splits.has(split)) result.duplicate_rows++;
          splits.add(split);
          images.set(image, splits);
        }
        for (const [field, raw] of Object.entries(row)) {
          if (excluded.has(field)) continue;
          const value = String(raw ?? "").trim() || "unknown";
          const groups = counts.get(field) || new Map();
          const key = JSON.stringify([split, value]);
          const group = groups.get(key) || { split, value, samples: 0 };
          group.samples++;
          groups.set(key, group);
          counts.set(field, groups);
        }
      }
    } catch (error) {
      result.warnings.push(
        `${split}: counts may be incomplete. ${(error as Error).message}`,
      );
    }
    result.splits.push(summary);
    result.total += summary.samples;
  }
  result.card_balance = [...cardBalance.values()];
  result.unique_images = images.size;
  result.cross_split_images = [...images.values()].filter(
    (splits) => splits.size > 1,
  ).length;
  result.counts = Object.fromEntries(
    [...counts].map(([key, groups]) => [key, [...groups.values()]]),
  );
  try {
    const source = await safe(join(directory, "dataset", "source_csvs.csv"));
    for await (const row of csvRows(source)) result.sources.push(row);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      result.warnings.push(`Source CSVs: ${(error as Error).message}`);
  }
  return result;
}
