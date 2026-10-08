import { baseUrl, headers } from "@/api/config";
import type { Row } from "@/api/types";

function requestUrl(path: string) {
  return path.startsWith("/studio-api/") ? path : baseUrl() + path;
}

export async function api<T = Row>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(requestUrl(path), {
    ...options,
    headers: {
      ...headers(),
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => {
          throw new Error(
            response.ok
              ? path.startsWith("/studio-api/")
                ? "Saved results service did not return JSON. Check that the saved-results reader is running."
                : "Backend did not return JSON. Check the API URL in Settings."
              : `HTTP ${response.status}`,
          );
        });
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail
          .map((item: Row) => `${item.loc?.join(".")}: ${item.msg}`)
          .join("; ")
      : data.detail;
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return data as T;
}
export function submit(path: string, body: Row, idempotent = true) {
  return api(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotent ? { "Idempotency-Key": crypto.randomUUID() } : {},
  });
}

export async function fetchBlob(path: string): Promise<Blob> {
  const response = await fetch(requestUrl(path), { headers: headers() });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  return response.blob();
}
