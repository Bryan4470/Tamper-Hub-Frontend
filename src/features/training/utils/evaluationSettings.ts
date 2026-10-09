import type { Row } from "@/api/types";

export const thresholdPrefix =
  "evaluation.classification_threshold_by_card_type";
export const farKey = "evaluation.far_constraint_threshold";
export const cardTypes = [
  "mykadfront",
  "mykadback",
  "mykadfront_2026",
  "mykadback_2026",
];

export function evaluationSettings(
  template: Row,
  overrides: Record<string, unknown>,
) {
  const configured = template.config?.evaluation || {};
  const thresholds = configured.classification_threshold_by_card_type || {};
  const read = (key: string, fallback: number) => {
    const value = key in overrides ? overrides[key] : fallback;
    return value === "" ? NaN : Number(value);
  };
  const fallback = read(
    `${thresholdPrefix}.mykadfront`,
    thresholds.mykadfront ?? 0.5,
  );
  return {
    thresholds: cardTypes.map((card) => ({
      card,
      value: read(`${thresholdPrefix}.${card}`, thresholds[card] ?? fallback),
    })),
    far: read(farKey, configured.far_constraint_threshold ?? 0.01),
  };
}
