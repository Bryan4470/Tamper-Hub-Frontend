export const pct = (n: unknown) =>
  typeof n === "number" ? `${(n * 100).toFixed(2)}%` : "N/A";
export const number = (n: unknown) =>
  typeof n === "number" ? n.toLocaleString() : "—";
export const short = (s: string = "") =>
  s.length > 24 ? `${s.slice(0, 13)}…${s.slice(-7)}` : s;
