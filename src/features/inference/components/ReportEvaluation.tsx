import type { InferenceReportData } from "@/api/inferenceReportTypes";
import { Notice } from "@/components/ui/Notice";
import { pct } from "@/utils/format";

export function ReportEvaluation({ report }: { report: InferenceReportData }) {
  const metrics = report.metrics;
  if (!metrics.num_samples)
    return (
      <Notice>
        Evaluation needs known labels. Use a labeled CSV or choose “Known label”
        before running. Predictions are still saved.
      </Notice>
    );
  return (
    <div>
      <p>
        {metrics.num_samples} labeled predictions evaluated. Failed and
        unlabeled images are excluded.
      </p>
      <div className="metric-grid">
        {[
          ["accuracy", "Accuracy"],
          ["precision", "Precision"],
          ["recall", "Recall"],
          ["f1_score", "F1"],
          ["auc_roc", "AUC"],
          ["far", "False acceptance (FAR)"],
          ["frr", "False rejection (FRR)"],
        ].map(([key, label]) => (
          <div className="metric" key={key}>
            <span>{label}</span>
            <strong>{pct(metrics[key])}</strong>
          </div>
        ))}
      </div>
      <h3>Confusion matrix</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Actual label</th>
              <th>Predicted genuine</th>
              <th>Predicted tampered</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Genuine</th>
              <td>{metrics.tn} correct</td>
              <td>{metrics.fp} false alarms</td>
            </tr>
            <tr>
              <th>Tampered</th>
              <td>{metrics.fn} missed tampering</td>
              <td>{metrics.tp} correct</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">
        FAR is missed tampering / actual tampered images. FRR is false alarms /
        actual genuine images. AUC needs both genuine and tampered examples;
        unavailable metrics show N/A.
      </p>
    </div>
  );
}
