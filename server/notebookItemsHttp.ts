import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ATTACHMENT_LIMIT, createNotebookItemsStore } from "./notebookItems.ts";

export function notebookItemsHandler(store = createNotebookItemsStore()) {
  return async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const json = (status: number, data: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const parts = url.pathname
        .slice("/studio-api/v1/notebook/items".length)
        .split("/")
        .filter(Boolean);
      if (req.method === "GET" && !parts.length) {
        json(200, await store.read());
        return;
      }
      if (
        parts.length === 3 &&
        parts[1] === "jobs" &&
        (req.method === "POST" || req.method === "DELETE")
      ) {
        json(
          200,
          await store.linkJob(parts[0], parts[2], req.method === "DELETE"),
        );
        return;
      }
      if (req.method === "DELETE" && parts.length === 1) {
        await store.remove(parts[0]);
        res.writeHead(204);
        res.end();
        return;
      }
      if (
        req.method === "GET" &&
        parts.length === 3 &&
        parts[1] === "attachments"
      ) {
        const file = await store.download(parts[0], parts[2]);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        });
        await pipeline(createReadStream(file.path), res);
        return;
      }
      const upload =
        req.method === "POST" &&
        parts.length === 2 &&
        parts[1] === "attachments";
      if (!(
        upload ||
        (req.method === "POST" && !parts.length) ||
        (req.method === "PUT" && parts.length === 1)
      )) {
        json(405, { detail: "Unsupported notebook operation" });
        return;
      }
      if (upload) {
        if (Number(req.headers["content-length"]) > ATTACHMENT_LIMIT) {
          json(413, { detail: "Attachments must be 500 MB or smaller" });
          return;
        }
        json(
          201,
          await store.attach(parts[0], url.searchParams.get("name") || "", req),
        );
        return;
      }
      const limit = 1024 * 1024;
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > limit) {
          json(413, {
            detail: "Notes must be smaller than 1 MB",
          });
          return;
        }
        chunks.push(buffer);
      }
      const body = Buffer.concat(chunks);
      let value;
      try {
        value = JSON.parse(body.toString("utf8"));
      } catch {
        json(400, { detail: "Invalid notebook JSON" });
        return;
      }
      if (!value || typeof value !== "object") {
        json(400, { detail: "Invalid notebook item" });
        return;
      }
      json(
        req.method === "POST" ? 201 : 200,
        req.method === "POST"
          ? await store.create(value.title, value.text)
          : await store.save(parts[0], value),
      );
    } catch (error) {
      const e = error as Error & { status?: number };
      if (res.headersSent) {
        res.destroy(e);
        return;
      }
      json(e.status || 500, {
        detail: e.status ? e.message : "Could not access notebook storage",
      });
    }
  };
}
