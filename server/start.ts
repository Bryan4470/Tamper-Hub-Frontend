import { createServer } from "node:http";
import { studioMiddleware } from "./middleware.ts";

const middleware = studioMiddleware();
const port = Number(process.env.TAMPER_STUDIO_PORT || 7502);
const host = process.env.TAMPER_STUDIO_HOST || "127.0.0.1";
createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  middleware(req, res, () => {
    res.writeHead(404);
    res.end();
  });
}).listen(port, host, () => {
  console.log(
    `Saved results reader: http://${host}:${port}/studio-api/v1/runs`,
  );
});
