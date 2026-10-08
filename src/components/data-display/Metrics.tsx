import type { Row } from "@/api/types";
import { pct } from "@/utils/format";

export function Metrics({ values }: { values: Row }) {
  return (
    <div className="metric-grid">
      {[
        ["far", "False acceptance", "Tampered accepted as genuine"],
        ["frr", "False rejection", "Genuine rejected as tampered"],
        ["f2_score", "F2 score", "Tamper recall weighted"],
        ["auc_roc", "ROC AUC", "Threshold-independent"],
      ].map(([key, label, hint]) => (
        <div className="metric" key={key}>
          <span>{label}</span>
          <strong>{pct(values[key])}</strong>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}
