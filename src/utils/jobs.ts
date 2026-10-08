export const terminal = (s: string) =>
  ["succeeded", "failed", "cancelled", "interrupted"].includes(s);
