import { useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { HubProps } from "@/app/types";

export function JobName({
  id,
  name,
  onSelect,
  act,
  busy,
}: {
  id: string;
  name: string;
  onSelect: () => void;
} & Pick<HubProps, "act" | "busy">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const edit = () => {
    setDraft(name);
    setEditing(true);
  };
  return editing ? (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim() || busy) return;
        void act(async () => {
          await api(endpoints.jobs.detail(id), {
            method: "PATCH",
            body: JSON.stringify({ name: draft.trim() }),
          });
          setEditing(false);
        }, "Experiment renamed.");
      }}
    >
      <input
        autoFocus
        aria-label="Experiment name"
        value={draft}
        maxLength={120}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) setEditing(false);
        }}
      />
      <button type="submit" disabled={busy || !draft.trim()}>
        Save
      </button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)}>
        Cancel
      </button>
    </form>
  ) : (
    <button
      className="text-button"
      title="Double-click to rename (or press F2)"
      onClick={onSelect}
      onDoubleClick={edit}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          event.preventDefault();
          edit();
        }
      }}
    >
      <strong>{name}</strong>
    </button>
  );
}
