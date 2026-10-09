import type { HubProps } from "@/app/types";
import { CreateNotebookItem } from "@/features/notebook/components/CreateNotebookItem";
import { Modal } from "@/components/ui/Modal";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { NotebookItem } from "@/api/notebookTypes";
import { NotebookEditor } from "@/features/notebook/components/NotebookEditor";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";

export function NotebookPage({ go }: Pick<HubProps, "go">) {
  const [items, setItems] = useState<NotebookItem[]>([]);
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<{ items: NotebookItem[] }>(endpoints.notebookItems.list)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
      })
      .catch((reason) => {
        if (active) setError((reason as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const current = items.find((item) => item.id === selected);
  return (
    <div className="notebook-list-page">
      <Card
        title="Notebook items"
        subtitle="Your notes and attachments, organized by item."
        action={
          <button
            className="primary"
            disabled={loading}
            onClick={() => setAdding(true)}
          >
            Add item
          </button>
        }
      >
        <Notice error>{error}</Notice>
        {loading ? (
          <p role="status">Loading notebook…</p>
        ) : (
          <div className="notebook-item-list">
            {!items.length && (
              <p className="muted">
                No items yet. Click Add item to create your first note.
              </p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selected === item.id ? "selected" : "secondary"}
                aria-pressed={selected === item.id}
                onClick={() => setSelected(item.id)}
              >
                {item.title}
                <small>
                  {item.attachments.length} attachment
                  {item.attachments.length === 1 ? "" : "s"}
                  {" · "}
                  {item.linkedJobIds?.length || 0} linked job
                  {item.linkedJobIds?.length === 1 ? "" : "s"}
                </small>
              </button>
            ))}
          </div>
        )}
      </Card>
      {adding && (
        <CreateNotebookItem
          onClose={() => setAdding(false)}
          onCreated={(item) => {
            setItems((value) => [...value, item]);
            setAdding(false);
          }}
        />
      )}
      {current && (
        <Modal title="Notebook item" onClose={() => setSelected("")}>
          <NotebookEditor
            key={current.id}
            item={current}
            go={go}
            onDeleted={() => {
              const remaining = items.filter((item) => item.id !== current.id);
              setItems(remaining);
              setSelected("");
            }}
            onSaved={(saved) =>
              setItems((value) =>
                value.map((item) => (item.id === saved.id ? saved : item)),
              )
            }
          />
        </Modal>
      )}
    </div>
  );
}
