import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

const supported = /\.(jpe?g|png|bmp|webp)$/i;

export function InferenceUploadInput({
  folder,
  files,
  onChange,
}: {
  folder: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(0);
  return (
    <>
      <Field
        label={folder ? "Upload image folder" : "Upload images"}
        hint="Up to 1,000 images, 20 MB per image and 500 MB total. Folder uploads include subfolders."
      >
        <input
          key={String(folder)}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.bmp,.webp"
          {...(folder ? { webkitdirectory: "" } : {})}
          onChange={(event) => {
            const all = Array.from(event.target.files || []);
            const images = all.filter((file) => supported.test(file.name));
            setSkipped(all.length - images.length);
            const message =
              images.length > 1000
                ? "Choose at most 1,000 images."
                : images.some((file) => file.size > 20 * 1024 * 1024)
                  ? "Each image must be 20 MB or smaller."
                  : images.reduce((sum, file) => sum + file.size, 0) >
                      500 * 1024 * 1024
                    ? "Total upload must be 500 MB or smaller."
                    : !images.length && all.length
                      ? "No supported images found."
                      : "";
            setError(message);
            onChange(message ? [] : images);
          }}
        />
      </Field>
      <Notice error>{error}</Notice>
      {skipped > 0 && (
        <p className="muted">Skipped {skipped} non-image files.</p>
      )}
      {files.length > 0 && (
        <div>
          <p role="status">
            {files.length} images selected ·{" "}
            {(
              files.reduce((sum, file) => sum + file.size, 0) /
              1024 /
              1024
            ).toFixed(1)}{" "}
            MB
          </p>
          <details>
            <summary>Selected images</summary>
            <ul>
              {files.slice(0, 20).map((file, index) => (
                <li key={index}>{file.webkitRelativePath || file.name}</li>
              ))}
            </ul>
            {files.length > 20 && <p>And {files.length - 20} more images.</p>}
          </details>
        </div>
      )}
    </>
  );
}
