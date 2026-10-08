import { useState } from "react";
import { baseUrl, getToken, saveConnection } from "@/api/config";
import type { HubProps } from "@/app/types";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

export function SettingsPage(props: HubProps & { onSave: () => void }) {
  const [url, setUrl] = useState(baseUrl()),
    [token, setToken] = useState(getToken());
  return (
    <div className="settings-grid">
      <Card
        title="Backend connection"
        subtitle="The frontend connects to the API in face-tamper-multiclass."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveConnection(url, token);
            props.onSave();
          }}
        >
          <Field
            label="API base URL"
            hint="Use /api/v1 with the development proxy, or an absolute backend URL."
          >
            <input
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field
            label="Bearer token"
            hint="Stored for this browser session only. Leave empty if the backend has no token configured."
          >
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
          <button className="primary">Save connection</button>
        </form>
        <div className="setup-note">
          <h3>Start the backend and worker</h3>
          <p>
            From the face-tamper-multiclass repository, in separate terminals:
          </p>
          <pre>
            python -m uvicorn api.main:app --host 127.0.0.1 --port 7501{"\n"}
            python -m api.worker --device cpu
          </pre>
          <p>
            For GPU execution, start another worker with a GPU UUID from the
            resource list. Add dataset mounts to{" "}
            <code>TAMPER_API_DATA_ROOTS</code> on both services.
          </p>
        </div>
      </Card>
      <Card
        title="Persistent storage"
        subtitle="All Hub-created metadata and artifacts are kept under this workspace."
      >
        <div className="storage-root">
          <span>Workspace root</span>
          <code>{props.workspace || "Backend unavailable"}</code>
        </div>
        <dl className="storage-list">
          {Object.entries(props.storage).map(([name, path]) => (
            <div key={name}>
              <dt>{name.replaceAll("_", " ")}</dt>
              <dd title={path}>{path}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          Original images remain in the source dataset. Collections save frozen
          manifests that reference those images.
        </p>
      </Card>
    </div>
  );
}
