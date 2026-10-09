import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createServer, request } from "node:http";
import { createNotebookItemsStore } from "./notebookItems.ts";
import { notebookItemsHandler } from "./notebookItemsHttp.ts";

test("notebook items migrate notes, isolate attachments, persist and reject stale edits", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "notebook-items-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, "notes.json"),
    JSON.stringify({ text: "Existing notes", revision: "old" }),
  );
  const store = createNotebookItemsStore(root);
  const legacy = (await store.read()).items[0];
  assert.equal(legacy.text, "Existing notes");
  const a = await store.create("Report");
  const b = await store.create("Spreadsheet");
  const pdf = Buffer.from("%PDF sample\u0000\u00ff");
  const attached = await store.attach(a.id, "report.pdf", pdf);
  const file = attached.attachments[0];
  assert.deepEqual(
    await readFile((await store.download(a.id, file.id)).path),
    pdf,
  );
  await assert.rejects(store.download(b.id, file.id), /not found/);
  await assert.rejects(store.attach(a.id, "../unsafe", pdf), /Invalid/);
  await assert.rejects(store.download(a.id, "../../notes.json"), /not found/);
  const saved = await store.save(a.id, {
    title: "Updated",
    text: "Details",
    revision: a.revision,
  });
  assert.equal(saved.attachments.length, 1);
  await assert.rejects(
    store.save(a.id, { title: "Stale", text: "Lost", revision: a.revision }),
    /another browser/,
  );
  assert.deepEqual(
    await createNotebookItemsStore(root).read(),
    await store.read(),
  );
  assert.equal(
    JSON.parse(await readFile(join(root, "notes.json"), "utf8")).text,
    "Existing notes",
  );
});

test("notebook item HTTP roundtrips binary attachments and validates requests", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "notebook-items-http-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const handle = notebookItemsHandler(createNotebookItemsStore(root));
  const server = createServer(
    (req, res) => void handle(req, res, new URL(req.url!, "http://localhost")),
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
  const base = `http://127.0.0.1:${address.port}/studio-api/v1/notebook/items`;
  assert.equal(
    (
      await fetch(base, {
        method: "POST",
        body: JSON.stringify({ title: " " }),
      })
    ).status,
    400,
  );
  const response = await fetch(base, {
    method: "POST",
    body: JSON.stringify({ title: "Test", text: "Created with details" }),
  });
  assert.equal(response.status, 201);
  const item = await response.json();
  assert.equal(item.text, "Created with details");
  const bytes = Buffer.alloc(21 * 1024 * 1024, 0xab);
  const upload = await fetch(
    `${base}/${item.id}/attachments?name=report.xlsx`,
    { method: "POST", body: bytes },
  );
  assert.equal(upload.status, 201);
  const attachment = (await upload.json()).attachments[0];
  const download = await fetch(
    `${base}/${item.id}/attachments/${attachment.id}`,
  );
  assert.match(download.headers.get("content-disposition")!, /attachment/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  const oversized = await new Promise<number | undefined>((resolve) => {
    const req = request(
      `${base}/${item.id}/attachments?name=big.pdf`,
      {
        method: "POST",
        headers: { "Content-Length": String(500 * 1024 * 1024 + 1) },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.end();
  });
  assert.equal(oversized, 413);
  assert.equal(
    (await fetch(`${base}/${item.id}`, { method: "DELETE" })).status,
    204,
  );
  assert.equal(
    (await fetch(`${base}/${item.id}/attachments/${attachment.id}`)).status,
    404,
  );
  await assert.rejects(readFile(join(root, "attachments", attachment.id)), {
    code: "ENOENT",
  });
  assert.equal(
    (await fetch(`${base}/missing`, { method: "DELETE" })).status,
    404,
  );
  assert.equal(
    (await fetch(`${base}/legacy`, { method: "DELETE" })).status,
    204,
  );
  assert.deepEqual((await createNotebookItemsStore(root).read()).items, []);
});

test("notebook job links persist independently and survive note edits", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "notebook-job-links-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = createNotebookItemsStore(root);
  const a = await store.create("Linked note", "Keep my notes");
  const b = await store.create("Other note");
  await store.linkJob(a.id, "job_example");
  await store.linkJob(a.id, "job_example");
  await store.save(a.id, {
    title: a.title,
    text: "Updated notes",
    revision: a.revision,
  });
  let data = await createNotebookItemsStore(root).read();
  assert.deepEqual(data.items.find((item) => item.id === a.id)?.linkedJobIds, [
    "job_example",
  ]);
  assert.deepEqual(
    data.items.find((item) => item.id === b.id)?.linkedJobIds || [],
    [],
  );
  await store.linkJob(a.id, "job_example", true);
  data = await store.read();
  assert.deepEqual(
    data.items.find((item) => item.id === a.id)?.linkedJobIds,
    [],
  );
  assert.equal(
    data.items.find((item) => item.id === a.id)?.text,
    "Updated notes",
  );
  assert.throws(() => store.linkJob(a.id, "../invalid"), /Invalid job/);
  await assert.rejects(store.linkJob("missing", "job_example"), /not found/);
});
