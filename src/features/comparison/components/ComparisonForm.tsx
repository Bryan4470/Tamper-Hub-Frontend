import { type FormEvent, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page } from "@/api/types";
import type { HubProps } from "@/app/types";
import { Picker } from "@/components/forms/Picker";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { useRemote } from "@/hooks/useRemote";
import { short } from "@/utils/format";

export function ComparisonForm(
  props: Pick<HubProps, "revision" | "busy" | "act"> & {
    onCreated: (id: string) => void;
  },
) {
  const evaluations = useRemote<Page>(
    endpoints.evaluations.list(1000),
    emptyPage,
    props.revision,
  );

  const successful = evaluations.data.items.filter(
    (e) => e.status === "succeeded",
  );
  const [baseline, setBaseline] = useState(""),
    [candidates, setCandidates] = useState<string[]>([]),
    [name, setName] = useState("Candidate vs baseline");
  const [metric, setMetric] = useState("frr"),
    [coverage, setCoverage] = useState("strict"),
    [threshold, setThreshold] = useState("same");

  function compare(e: FormEvent) {
    e.preventDefault();
    props.act(async () => {
      const r = await submit(endpoints.comparisons.create, {
        name,
        baseline_evaluation_id: baseline,
        candidate_evaluation_ids: candidates,
        metric,
        coverage_policy: coverage,
        threshold_policy: threshold,
      });
      props.onCreated(r.resource_id);
    }, "Comparison queued.");
  }

  return (
    <Card
      title="Set up a comparison"
      subtitle="Every comparison reports coverage and threshold compatibility before ranking."
    >
      <form onSubmit={compare}>
        <div className="form-grid">
          <Field label="Comparison name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Baseline evaluation">
            <select
              required
              value={baseline}
              onChange={(e) => {
                setBaseline(e.target.value);
                setCandidates((c) => c.filter((id) => id !== e.target.value));
              }}
            >
              <option value="">Choose baseline</option>
              {successful.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {short(e.id)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Picker
          label="Candidate evaluations"
          items={successful.filter((e) => e.id !== baseline)}
          selected={candidates}
          onChange={setCandidates}
        />
        <div className="form-grid three">
          <Field label="Ranking metric">
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {[
                ["frr", "Lowest FRR"],
                ["far", "Lowest FAR"],
                ["f2_score", "Highest F2"],
                ["f1_score", "Highest F1"],
                ["auc_roc", "Highest ROC AUC"],
                ["accuracy", "Highest accuracy"],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sample coverage">
            <select
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            >
              <option value="strict">Require matching coverage</option>
              <option value="intersection">
                Recalculate on common samples
              </option>
            </select>
          </Field>
          <Field label="Threshold policy">
            <select
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            >
              <option value="same">Require the same thresholds</option>
              <option value="per_evaluation">
                Use each evaluation's thresholds
              </option>
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <BusyButton
            busy={props.busy}
            disabled={!baseline || !candidates.length}
          >
            Compare evaluations ↗
          </BusyButton>
        </div>
      </form>
    </Card>
  );
}
