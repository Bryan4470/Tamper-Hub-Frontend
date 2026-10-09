import type { ReactNode } from "react";
import type { Row } from "@/api/types";

export function Table({
  columns,
  rows,
  onRow,
  selected,
}: {
  columns: {
    key: string;
    label: ReactNode;
    render?: (row: Row) => ReactNode;
  }[];
  rows: Row[];
  onRow?: (row: Row) => void;
  selected?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || row.sample_id || index}
              className={selected === row.id ? "selected" : ""}
            >
              {columns.map((c, i) => (
                <td key={c.key}>
                  {onRow && i === 0 ? (
                    <button className="text-button" onClick={() => onRow(row)}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </button>
                  ) : c.render ? (
                    c.render(row)
                  ) : typeof row[c.key] === "object" ? (
                    JSON.stringify(row[c.key])
                  ) : (
                    String(row[c.key] ?? "—")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
