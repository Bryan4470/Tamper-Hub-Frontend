import { useState } from "react";
import { endpoints } from "@/api/endpoints";
import { emptyPage, type Page, type Row } from "@/api/types";
import type { HubProps, PageName } from "@/app/types";
import { useRemote } from "@/hooks/useRemote";

export function useHub() {
  const [page, setPage] = useState<PageName>("overview"),
    [target, setTarget] = useState(""),
    [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [actionError, setActionError] = useState("");
  const health = useRemote<Row>(endpoints.system.health, {}, revision, 10000);
  const datasets = useRemote<Page>(
    endpoints.datasets.list(1000),
    emptyPage,
    revision,
    15000,
  );
  const models = useRemote<Page>(
    endpoints.models.list(1000),
    emptyPage,
    revision,
    15000,
  );
  const gpu = useRemote<Row>(
    endpoints.system.gpus,
    { gpus: [], workers: [] },
    revision,
    10000,
  );
  const go = (next: PageName, id = "") => {
    setPage(next);
    setTarget(id);
    setMessage("");
    setActionError("");
    window.scrollTo(0, 0);
  };
  const act = async (
    work: () => Promise<unknown>,
    success = "Saved successfully.",
  ) => {
    setBusy(true);
    setMessage("");
    setActionError("");
    try {
      await work();
      setRevision((r) => r + 1);
      setMessage(success);
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const props: HubProps = {
    datasets: datasets.data.items,
    models: models.data.items,
    gpus: gpu.data.gpus || [],
    revision,
    busy,
    target,
    workspace: health.data.workspace || "",
    storage: health.data.storage || {},
    act,
    go,
  };
  const connected = !!health.data.status && !health.error;

  const refresh = () => setRevision((r) => r + 1);
  return {
    page,
    props,
    health,
    workers: gpu.data.workers || [],
    connected,
    refresh,
    actionError,
    message,
  };
}
