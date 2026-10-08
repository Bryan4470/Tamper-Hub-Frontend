import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import type { ResultRow } from "../src/api/studioTypes.ts";

// Stream records (including quoted newlines) so prediction files need not fit in memory.
export async function* csvRecords(path: string): AsyncGenerator<string[]> {
  const input = createReadStream(path);
  const stream = path.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  input.on("error", (error) => stream.destroy(error));
  stream.setEncoding("utf8");
  let field = "",
    row: string[] = [],
    quoted = false,
    afterQuote = false;
  let first = true;
  try {
    for await (const chunk of stream) {
      for (const char of String(chunk)) {
        if (first) {
          first = false;
          if (char === "\uFEFF") continue;
        }
        if (quoted) {
          if (char === '"') {
            quoted = false;
            afterQuote = true;
          } else field += char;
        } else if (afterQuote && char === '"') {
          field += '"';
          quoted = true;
          afterQuote = false;
        } else if (char === ",") {
          row.push(field);
          field = "";
          afterQuote = false;
        } else if (char === "\n") {
          row.push(field);
          field = "";
          afterQuote = false;
          if (row.some((value) => value !== "")) yield row;
          row = [];
        } else if (char === "\r") {
          // CRLF outside quotes; embedded CRLF remains part of the quoted value.
        } else if (char === '"' && !field && !afterQuote) {
          quoted = true;
        } else {
          if (afterQuote)
            throw new Error("Invalid character after a CSV quote");
          field += char;
        }
        if (field.length > 4 * 1024 * 1024 || row.length > 2000)
          throw new Error("CSV record exceeds the supported size");
      }
    }
    if (quoted)
      throw new Error(
        "Incomplete quoted CSV record; the file may still be writing",
      );
    if (field || row.length || afterQuote) yield [...row, field];
  } finally {
    stream.destroy();
    input.destroy();
  }
}

const numericColumn =
  /^(epoch|rank|lr|threshold|confidence|prob_.+|logit_.+|.*_index|.*_loss|loss|.*accuracy|.*precision|.*recall|.*f1|.*f2|f1_score|f2_score|.*auc|auc_roc|.*far|.*frr|tp|tn|fp|fn|num_.+|.*_seconds)$/;

export async function* csvRows(path: string): AsyncGenerator<ResultRow> {
  let columns: string[] | undefined;
  for await (const values of csvRecords(path)) {
    if (!columns) {
      columns = values;
      if (new Set(columns).size !== columns.length)
        throw new Error("Duplicate CSV column names");
      continue;
    }
    if (values.length !== columns.length)
      throw new Error("CSV row does not match its header");
    yield Object.fromEntries(
      columns.map((key, i) => {
        const raw = values[i];
        const missing = /^(nan|null|none|n\/a)$/i.test(raw) || !raw.trim();
        const value = numericColumn.test(key)
          ? missing || !Number.isFinite(Number(raw))
            ? null
            : Number(raw)
          : raw;
        return [key, value];
      }),
    );
  }
}
