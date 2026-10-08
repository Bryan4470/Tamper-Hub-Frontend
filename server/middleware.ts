import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { createStudioReader, studioRoots } from "./studio.ts";

export function studioMiddleware(reader = createStudioReader(studioRoots())) {
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
        /^\/studio-api\/v1\/runs\/([a-f0-9]{24})(?:\/(table|download|distribution|epochs|performance))?$/.exec(
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
