import { useEffect, useState } from "react";
import { api } from "@/api/client";

export function useRemote<T>(
  path: string | null,
  initial: T,
  refresh = 0,
  interval = 5000,
) {
  const [data, setData] = useState<T>(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    setError("");
    if (!path) {
      setData(initial);
      setLoading(false);
      return;
    }
    setLoading(true);
    setData(initial);
    const load = async () => {
      try {
        const value = await api<T>(path, { signal: controller.signal });
        if (active) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(load, interval);
        }
      }
    };
    load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, refresh, interval]); // initial values are intentionally not effect dependencies
  return { data, error, loading };
}
