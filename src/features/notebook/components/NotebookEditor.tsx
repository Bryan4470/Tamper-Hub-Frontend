import type { HubProps } from "@/app/types";
import { NotebookJobs } from "@/features/notebook/components/NotebookJobs";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { downloadFile } from "@/api/artifacts";
import { endpoints } from "@/api/endpoints";
import type { NotebookItem } from "@/api/notebookTypes";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

export function NotebookEditor({
  item,
  onSaved,
  onDeleted,
  go,
}: {
  go: HubProps["go"];
  item: NotebookItem;
  onSaved: (item: NotebookItem) => void;
  onDeleted: () => void;
}) {
  const storageKey = `tamper-hub:notebook:item:${item.id}`;
  const [title, setTitle] = useState(item.title);
  const [text, setText] = useState(item.text);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ title: string; text: string } | null>(
    () => {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const value = JSON.parse(cached);
          if (
            typeof value.title === "string" &&
            typeof value.text === "string" &&
            (value.title !== item.title || value.text !== item.text)
          )
            return value;
        }
        const legacy = localStorage.getItem("tamper-hub:notebook");
        if (item.id === "legacy" && legacy !== null && legacy !== item.text)
          return { title: item.title, text: legacy };
      } catch {
        /* Optional draft recovery. */
      }
      return null;
    },
  );
  const dirty = title !== item.title || text !== item.text;
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ title, text }));
    } catch {
      /* Server save remains available. */
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, title, text, storageKey]);
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api<NotebookItem>(
        endpoints.notebookItems.item(item.id),
        {
          method: "PUT",
          body: JSON.stringify({ title, text, revision: item.revision }),
        },
      );
      onSaved(saved);
      setTitle(saved.title);
      setDraft(null);
      setMessage("Saved on server.");
      try {
        localStorage.removeItem(storageKey);
        if (item.id === "legacy")
          localStorage.removeItem("tamper-hub:notebook");
      } catch {
        /* Optional draft cache. */
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: File[]) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      for (const file of files) {
        if (file.size > 500 * 1024 * 1024)
          throw new Error(`${file.name} exceeds the 500 MB attachment limit.`);
        const saved = await api<NotebookItem>(
          endpoints.notebookItems.upload(item.id, file.name),
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
          },
        );
        onSaved({ ...item, attachments: saved.attachments });
      }
      setMessage("Attachments saved on server.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      title={item.title}
      action={
        <button
          type="button"
          className="danger-button small"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                `Delete “${item.title}” and all its notes and attachments? This cannot be undone.`,
              )
            )
              return;
            setBusy(true);
            setError("");
            void api(endpoints.notebookItems.item(item.id), {
              method: "DELETE",
            })
              .then(() => {
                try {
                  localStorage.removeItem(storageKey);
                  if (item.id === "legacy")
                    localStorage.removeItem("tamper-hub:notebook");
                } catch {
                  /* Optional draft cache. */
                }
                onDeleted();
              })
              .catch((reason) => setError((reason as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          Delete item
        </button>
      }
      subtitle="Keep notes and supporting files together."
    >
      <Notice error>{error}</Notice>
      {draft && (
        <p>
          Unsaved notes are available in this browser.{" "}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setTitle(draft.title);
              setText(draft.text);
              setDraft(null);
            }}
          >
            Restore browser draft
          </button>
        </p>
      )}
      <Field label="Item title">
        <input
          value={title}
          maxLength={160}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="Your notes">
        <textarea
          className="notebook-editor"
          rows={4}
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add notes for this item…"
        />
      </Field>
      <div className="form-actions">
        <button
          className="primary"
          disabled={busy || !dirty || !title.trim()}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save notes"}
        </button>
        <span className="muted" role="status">
          {dirty
            ? "Unsaved changes — click Save notes."
            : message || "Saved on server."}
        </span>
      </div>
      <h3>Linked jobs</h3>
      <NotebookJobs
        item={item}
        disabled={busy}
        go={go}
        onUpdated={(ids) => onSaved({ ...item, linkedJobIds: ids })}
      />
      <h3>Attachments</h3>
      <Field
        label="Add attachments"
        hint="PDF, Excel, documents, images, and other files. Up to 500 MB per file."
      >
        <input
          type="file"
          multiple
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) void upload(files);
          }}
        />
      </Field>
      {item.attachments.length ? (
        <ul className="notebook-attachments">
          {item.attachments.map((file) => (
            <li key={file.id}>
              <button
                className="text-button"
                onClick={() => {
                  void downloadFile(
                    endpoints.notebookItems.attachment(item.id, file.id),
                    file.name,
                  ).catch((reason) => setError((reason as Error).message));
                }}
              >
                {file.name}
              </button>
              <span className="muted">{(file.size / 1024).toFixed(1)} KB</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No attachments yet.</p>
      )}
    </Card>
  );
}
