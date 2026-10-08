import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";

export function useJobLogs(selected: string) {
  const [logs, setLogs] = useState(""),
    [logError, setLogError] = useState("");
  useEffect(() => {
    setLogs("");
    setLogError("");
    if (!selected) return;
    let active = true,
      cursor = 0,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const value = await api(endpoints.jobs.logs(selected, cursor));
        if (!active) return;
        cursor = value.next_cursor;
        setLogs((prev) => (prev + value.text).slice(-200000));
        setLogError("");
        if (!value.finished || value.text) timer = setTimeout(load, 1500);
      } catch (e) {
        if (active) {
          setLogError((e as Error).message);
          timer = setTimeout(load, 3000);
        }
      }
    }
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selected]);

  return { logs, logError };
}
