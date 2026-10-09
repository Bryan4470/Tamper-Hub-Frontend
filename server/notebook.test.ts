import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createServer } from "node:http";
import { createNotebookStore } from "./notebook.ts";
import { studioMiddleware } from "./middleware.ts";

test("notebook persists across store restarts and rejects stale concurrent edits", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "notebook-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "notes", "notes.json");
  const store = createNotebookStore(path);
  assert.deepEqual(await store.read(), { text: "", revision: "" });
  const saved = await store.save("Future updates 📝", "");
  assert.deepEqual(await createNotebookStore(path).read(), saved);
  assert.equal(JSON.parse(await readFile(path, "utf8")).text, saved.text);
  const results = await Promise.allSettled([
    store.save("First edit", saved.revision),
    store.save("Stale edit", saved.revision),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal((await store.read()).text, "First edit");
  const cleared = await store.save("", (await store.read()).revision);
  assert.deepEqual(await createNotebookStore(path).read(), cleared);
});

test("notebook HTTP validates writes and blocks cross-origin writes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "notebook-http-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const middleware = studioMiddleware(
    undefined,
    createNotebookStore(join(directory, "notes.json")),
  );
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );
  const address = server.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/studio-api/v1/notebook`;
  const token = process.env.TAMPER_STUDIO_TOKEN;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const put = (body: string, extra = {}) =>
    fetch(url, { method: "PUT", headers: { ...headers, ...extra }, body });
  assert.equal(
    (await put("{}", { Origin: "https://example.com" })).status,
    403,
  );
  assert.equal((await put("{}")).status, 400);
  assert.equal((await put("bad json")).status, 400);
  assert.equal(
    (await put(JSON.stringify({ text: "a".repeat(1024 * 1024), revision: "" })))
      .status,
    413,
  );
  const saved = await put(JSON.stringify({ text: "Updates 📝", revision: "" }));
  assert.equal(saved.status, 200);
  assert.equal(
    (await (await fetch(url, { headers })).json()).text,
    "Updates 📝",
  );
  assert.equal(
    (await put(JSON.stringify({ text: "stale", revision: "" }))).status,
    409,
  );
});
