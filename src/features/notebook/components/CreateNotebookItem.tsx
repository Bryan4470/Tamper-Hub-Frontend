import { useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { NotebookItem } from "@/api/notebookTypes";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";

export function CreateNotebookItem({
  onCreated,
  onClose,
}: {
  onCreated: (item: NotebookItem) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<NotebookItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const close = () => {
    if (created) onCreated(created);
    else onClose();
  };
  async function submit() {
    setBusy(true);
    setError("");
    try {
      let item = created;
      if (!item) {
        setProgress("Creating item…");
        item = await api<NotebookItem>(endpoints.notebookItems.list, {
          method: "POST",
          body: JSON.stringify({ title, text }),
        });
        setCreated(item);
      }
      for (const file of files) {
        setProgress(`Uploading ${file.name}…`);
        item = await api<NotebookItem>(
          endpoints.notebookItems.upload(item.id, file.name),
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
          },
        );
        setCreated(item);
        setFiles((remaining) => remaining.filter((value) => value !== file));
      }
      onCreated(item);
    } catch (reason) {
      setError(
        `${(reason as Error).message} You can retry without creating a duplicate item.`,
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Modal title="Add notebook item" busy={busy} onClose={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && title.trim()) void submit();
        }}
      >
        <Notice error>{error}</Notice>
        {created && error && (
          <p>
            Your item and notes are saved. Retry to upload the remaining
            attachments, or close to keep the item as it is.
          </p>
        )}
        <Field label="Item title">
          <input
            autoFocus
            required
            maxLength={160}
            value={title}
            disabled={busy || !!created}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give this item a name"
          />
        </Field>
        <Field label="Your notes">
          <textarea
            rows={4}
            value={text}
            disabled={busy || !!created}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add details, ideas, or reminders…"
          />
        </Field>
        <Field
          label="Attachments"
          hint="Optional. PDF, Excel, images, and other files — up to 500 MB each."
        >
          <input
            type="file"
            multiple
            disabled={busy}
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              event.target.value = "";
              if (selected.some((file) => file.size > 500 * 1024 * 1024)) {
                setError("Each attachment must be 500 MB or smaller.");
                return;
              }
              setError("");
              setFiles((current) => [...current, ...selected]);
            }}
          />
        </Field>
        {files.length > 0 && (
          <ul className="notebook-attachments">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p role="status" className="muted">
          {progress}
        </p>
        <div className="notebook-modal-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={busy || !title.trim()}
          >
            {busy ? "Submitting…" : created ? "Retry attachments" : "Submit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
