export function Status({ value }: { value?: string }) {
  return (
    <span className={`status ${value || "unknown"}`}>
      <i />
      {(value || "unknown").replaceAll("_", " ")}
    </span>
  );
}
