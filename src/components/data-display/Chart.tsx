import type { Row } from "@/api/types";
import { Empty } from "@/components/ui/Empty";

export function Chart({
  rows,
  xKey,
  lines,
  title,
}: {
  rows: Row[];
  xKey: string;
  lines: { key: string; label: string; color: string }[];
  title: string;
}) {
  const numeric = (value: unknown) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));
  const validRows = rows.filter((row) => numeric(row[xKey]));
  const numbers = validRows
    .flatMap((r) =>
      lines.filter((l) => numeric(r[l.key])).map((l) => Number(r[l.key])),
    )
    .filter(Number.isFinite);
  if (!validRows.length || !numbers.length)
    return <Empty title="Chart will appear when metrics are available" />;
  const maxX = Math.max(...validRows.map((r) => Number(r[xKey])), 1),
    maxY = Math.max(...numbers, 0.001),
    minY = Math.min(0, ...numbers);
  const x = (v: number) => 42 + (v / maxX) * 690,
    y = (v: number) => 204 - ((v - minY) / (maxY - minY)) * 175;
  return (
    <div className="chart">
      <div className="chart-title">
        {title}
        <span>
          {lines.map((l) => (
            <span key={l.key}>
              <i style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </span>
      </div>
      <svg viewBox="0 0 760 235" role="img" aria-label={title}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="42"
              x2="733"
              y1={29 + t * 175}
              y2={29 + t * 175}
              stroke="#e7ebe8"
            />
            <text x="34" y={33 + t * 175} textAnchor="end">
              {(maxY - (maxY - minY) * t).toFixed(2)}
            </text>
          </g>
        ))}
        {lines.map((l) => (
          <polyline
            key={l.key}
            fill="none"
            stroke={l.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            points={validRows
              .filter((r) => numeric(r[l.key]))
              .map((r) => `${x(Number(r[xKey]))},${y(Number(r[l.key]))}`)
              .join(" ")}
          />
        ))}
        <text x="42" y="225">
          0
        </text>
        <text x="730" y="225" textAnchor="end">
          {maxX.toFixed(maxX > 1 ? 0 : 2)} {xKey}
        </text>
      </svg>
    </div>
  );
}
