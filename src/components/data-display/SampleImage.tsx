import { useEffect, useState } from "react";
import { fetchBlob } from "@/api/client";

export function SampleImage({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true,
      objectUrl = "";
    fetchBlob(path.replace(/^\/api\/v1(?=\/)/, ""))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return url ? (
    <img src={url} alt="Dataset sample" loading="lazy" />
  ) : (
    <div className="image-placeholder">Image unavailable</div>
  );
}
