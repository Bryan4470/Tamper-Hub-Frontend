import { fetchBlob } from "@/api/client";
import { endpoints } from "@/api/endpoints";

export async function download(id: string, filename = "report.json") {
  return downloadFile(endpoints.artifacts.download(id), filename);
}

export async function downloadFile(path: string, filename: string) {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
