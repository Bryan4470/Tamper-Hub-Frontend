import { type FormEvent, useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { HubProps } from "@/app/types";
import { BusyButton } from "@/components/ui/BusyButton";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

export function DatasetRegistrationForm(
  props: Pick<HubProps, "busy" | "act"> & {
    onRegistered: (id: string) => void;
  },
) {
  const [name, setName] = useState(""),
    [path, setPath] = useState(""),
    [label, setLabel] = useState(""),
    [card, setCard] = useState("mykadfront");

  function register(e: FormEvent) {
    e.preventDefault();
    props.act(async () => {
      const d = await submit(
        endpoints.datasets.create,
        { name, path, default_label: label || null, card_type: card },
        false,
      );
      props.onRegistered(d.id);
      setName("");
      setPath("");
    }, "Dataset registered with a versioned manifest.");
  }

  return (
    <Card
      title="Register a dataset"
      subtitle="Paths refer to files mounted on the backend host."
    >
      <form onSubmit={register}>
        <div className="form-grid">
          <Field label="Dataset name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MyKad front · validation"
            />
          </Field>
          <Field label="CSV or image directory">
            <input
              required
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/mnt5/dataset/tamper/validation.csv"
            />
          </Field>
          <Field
            label="Fallback label"
            hint="Used only when a row has no label."
          >
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="">Keep unlabeled</option>
              <option value="genuine">Genuine</option>
              <option value="tamper">Tampered</option>
            </select>
          </Field>
          <Field label="Fallback card type">
            <select value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="mykadfront">MyKad front</option>
              <option value="mykadback">MyKad back</option>
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <BusyButton busy={props.busy}>Register dataset</BusyButton>
        </div>
      </form>
    </Card>
  );
}
