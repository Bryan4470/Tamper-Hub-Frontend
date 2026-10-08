import { useId, useState } from "react";

const explanations: Record<string, string> = {
  far: "False acceptance rate: the percentage of tampered images incorrectly accepted as genuine. FAR = FN / (TP + FN). Lower is better.",
  frr: "False rejection rate: the percentage of genuine images incorrectly flagged as tampered. FRR = FP / (TN + FP). Lower is better.",
  recall:
    "Tamper recall: the percentage of tampered images correctly detected. Recall = TP / (TP + FN). Higher is better.",
  f1_score:
    "F1 balances precision and tamper recall using their harmonic mean. Precision measures how many tamper alerts are correct. Higher is better.",
  f2_score:
    "F2 combines precision and tamper recall, giving recall four times the weight of precision in the formula. It emphasizes catching tampered images. Higher is better.",
  auc_roc:
    "ROC AUC measures how well model scores separate tampered and genuine images across thresholds. 100% is perfect; 50% is chance-level ranking. It requires scores and both classes.",
  tp: "True positives: tampered images correctly identified as tampered. Tamper is the positive class.",
  tn: "True negatives: genuine images correctly accepted as genuine.",
  fp: "False positives: genuine images incorrectly rejected as tampered. These contribute to the false rejection rate (FRR).",
  fn: "False negatives: tampered images incorrectly accepted as genuine. These contribute to the false acceptance rate (FAR).",
};

export function MetricLabel({
  metric,
  label,
}: {
  metric: string;
  label: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const explanation = explanations[metric];
  const show = () => {
    setDismissed(false);
    setOpen(true);
  };
  return (
    <span className="metric-label">
      {label}{" "}
      {explanation && (
        <span
          className="metric-help"
          onMouseEnter={show}
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            className="metric-help-button"
            aria-label={`About ${label}`}
            aria-describedby={open && !dismissed ? id : undefined}
            onFocus={show}
            onBlur={() => setOpen(false)}
            onClick={show}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setDismissed(true);
              }
            }}
          >
            ?
          </button>
          {open && !dismissed && (
            <span id={id} role="tooltip" className="metric-help-text">
              {explanation} N/A means there is not enough data to calculate the
              metric.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
