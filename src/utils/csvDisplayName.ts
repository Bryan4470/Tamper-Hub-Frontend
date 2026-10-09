export function csvDisplayName(value: unknown): string {
  const parts = String(value ?? "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  const card = parts.findIndex((part) =>
    /^mykad(front|back)(?:_2026)?$/.test(part),
  );
  if (card >= 0)
    return parts
      .slice(card)
      .filter(
        (part, index) => index === 0 || !["genuine", "tamper"].includes(part),
      )
      .join("/");
  return parts.at(-1) || "N/A";
}
