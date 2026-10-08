import { createServer } from "node:http";
import { studioMiddleware } from "./middleware.ts";

const middleware = studioMiddleware();
const port = Number(process.env.TAMPER_STUDIO_PORT || 7502);
createServer((req, res) =>
  middleware(req, res, () => {
    res.writeHead(404);
    res.end();
  }),
).listen(port, "127.0.0.1", () => {
  console.log(
    `Saved results reader: http://127.0.0.1:${port}/studio-api/v1/runs`,
  );
});
