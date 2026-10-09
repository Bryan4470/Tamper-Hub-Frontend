import { notebookItemsHandler } from "./notebookItemsHttp.ts";
import { createNotebookStore } from "./notebook.ts";
import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { createStudioReader, studioRoots } from "./studio.ts";

export function studioMiddleware(
  reader = createStudioReader(studioRoots()),
  notebook = createNotebookStore(),
) {
  const handleItems = notebookItemsHandler();
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/studio-api/")) {
      next();
      return;
    }
    const json = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    // Local results are same-origin only. Optional auth uses the shared bearer header.
    let crossOrigin = req.headers["sec-fetch-site"] === "cross-site";
    if (req.headers.origin) {
      try {
        crossOrigin ||= new URL(req.headers.origin).host !== req.headers.host;
      } catch {
        crossOrigin = true;
      }
    }
    if (crossOrigin) {
      json(403, {
        detail: "Saved results are only available to the same-origin frontend",
      });
      return;
    }
    if (
      process.env.TAMPER_STUDIO_TOKEN &&
      req.headers.authorization !== `Bearer ${process.env.TAMPER_STUDIO_TOKEN}`
    ) {
      json(401, {
        detail:
          "Saved results require a bearer token. Update connection settings.",
      });
      return;
    }
    if (
      url.pathname === "/studio-api/v1/notebook/items" ||
      url.pathname.startsWith("/studio-api/v1/notebook/items/")
    ) {
      void handleItems(req, res, url);
      return;
    }
    if (url.pathname === "/studio-api/v1/notebook") {
      const handleNotebook = async () => {
        if (req.method === "GET") {
          json(200, await notebook.read());
          return;
        }
        if (req.method !== "PUT") {
          res.setHeader("Allow", "GET, PUT");
          json(405, { detail: "Use GET or PUT for notebook notes" });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          const buffer = Buffer.from(chunk);
          chunks.push(buffer);
          size += buffer.length;
          if (size > 1024 * 1024) {
            json(413, { detail: "Notes must be smaller than 1 MB" });
            return;
          }
        }
        let value;
        try {
          value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          json(400, { detail: "Invalid notebook JSON" });
          return;
        }
        if (
          !value ||
          typeof value.text !== "string" ||
          typeof value.revision !== "string"
        ) {
          json(400, { detail: "Notebook text and revision must be strings" });
          return;
        }
        json(200, await notebook.save(value.text, value.revision));
      };
      void handleNotebook().catch((error: Error & { status?: number }) => {
        json(error.status || 500, {
          detail: error.status
            ? error.message
            : "Could not access notebook storage. Check server storage permissions.",
        });
      });
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      json(405, { detail: "Saved results are read-only" });
      return;
    }
    const handle = async () => {
      if (url.pathname === "/studio-api/v1/runs") {
        json(200, await reader.list());
        return;
      }
      if (url.pathname === "/studio-api/v1/checkpoints") {
        json(200, await reader.checkpoints());
        return;
      }
      const match =
        /^\/studio-api\/v1\/runs\/([a-f0-9]{24})(?:\/(table|download|distribution|epochs|performance|image))?$/.exec(
          url.pathname,
        );
      if (!match) {
        json(404, { detail: "Saved result endpoint not found" });
        return;
      }
      const [, id, action] = match;
      if (!action) {
        json(200, await reader.detail(id));
        return;
      }
      if (action === "distribution") {
        json(200, await reader.distribution(id));
        return;
      }
      if (action === "epochs") {
        json(200, await reader.epochs(id));
        return;
      }
      const artifact = url.searchParams.get("artifact") || "";
      if (action === "performance") {
        json(200, await reader.performance(id, artifact));
        return;
      }
      if (action === "table") {
        json(200, await reader.table(id, artifact, url.searchParams));
        return;
      }
      if (action === "image") {
        const { path, contentType } = await reader.predictionImage(
          id,
          artifact,
          url.searchParams.get("index") || "",
        );
        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=60",
          "X-Content-Type-Options": "nosniff",
        });
        await pipeline(createReadStream(path), res);
        return;
      }
      const path = await reader.downloadPath(id, artifact);
      res.writeHead(200, {
        "Content-Type": path.endsWith(".gz")
          ? "application/gzip"
          : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(basename(path))}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      await pipeline(createReadStream(path), res);
    };
    void handle().catch((error: Error) => {
      if (res.headersSent) res.destroy();
      else
        json(400, { detail: `Could not read saved results: ${error.message}` });
    });
  };
}
