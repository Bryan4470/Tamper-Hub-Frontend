import { useState } from "react";
import { submit } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { HubProps } from "@/app/types";
import { BusyButton } from "@/components/ui/BusyButton";
import { Field } from "@/components/ui/Field";

export function TrainingImportForm(
  props: Pick<HubProps, "busy" | "act"> & { onImported: (id: string) => void },
) {
  const [importPath, setImportPath] = useState("");
  return (
    <details className="disclosure">
      <summary>Import an existing training run</summary>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          props.act(async () => {
            const r = await submit(
              endpoints.training.import,
              { path: importPath },
              false,
            );
            props.onImported(r.id);
          }, "Existing run imported.");
        }}
      >
        <Field label="Run directory">
          <input
            value={importPath}
            onChange={(e) => setImportPath(e.target.value)}
            required
            placeholder="/path/to/checkpoints/run_folder"
          />
        </Field>
        <BusyButton busy={props.busy}>Import run</BusyButton>
      </form>
    </details>
  );
}
