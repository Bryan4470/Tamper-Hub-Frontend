import type { PageName } from "@/app/types";
const paths: Record<PageName, string> = {
  notebook: "M5 3h15v18H5z M3 7h4 M3 12h4 M3 17h4 M10 8h6 M10 12h6 M10 16h4",
  gradcam:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  overview: "M3 10 12 3l9 7v11h-6v-7H9v7H3z",
  training: "m12 3 10 5-10 5L2 8z M2 13l10 5 10-5 M2 18l10 5 10-5",
  inference: "M8 5v14l11-7z M3 4v16",
  evaluation: "M3 3v18h18 M7 15l4-5 4 3 6-8",
  results: "M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h6",
  comparison: "M3 7h18l-4-4 M21 17H3l4 4 M21 7l-4 4 M3 17l4-4",
  datasets: "m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5l10 5",
  models: "M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01 M12 10v4",
  jobs: "M9 6h12 M9 12h12 M9 18h12 M3 6h.01 M3 12h.01 M3 18h.01",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
};
export function HubIcon({
  name,
  size = 20,
}: {
  name: PageName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
