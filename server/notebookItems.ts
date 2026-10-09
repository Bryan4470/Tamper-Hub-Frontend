import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { notebookPath } from "./notebook.ts";

export const ATTACHMENT_LIMIT = 500 * 1024 * 1024;

type Attachment = { id: string; name: string; size: number };
type Item = {
  id: string;
  title: string;
  text: string;
  revision: string;
  attachments: Attachment[];
  linkedJobIds?: string[];
};
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
export function createNotebookItemsStore(root = dirname(notebookPath())) {
  const path = join(root, "items.json");
  let pending: Promise<unknown> = Promise.resolve();
  async function read(): Promise<{ items: Item[] }> {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      const old = JSON.parse(await readFile(join(root, "notes.json"), "utf8"));
      return {
        items: [
          {
            id: "legacy",
            title: "Future updates",
            text: old.text || "",
            revision: old.revision || "",
            attachments: [],
          },
        ],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return {
      items: [
        {
          id: "legacy",
          title: "Future updates",
          text: "",
          revision: "",
          attachments: [],
        },
      ],
    };
  }
  function mutate<T>(
    change: (data: { items: Item[] }) => Promise<T> | T,
  ): Promise<T> {
    const work = pending.then(async () => {
      const data = await read();
      const result = await change(data);
      await mkdir(root, { recursive: true });
      const temp = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, JSON.stringify(data), {
          mode: 0o600,
          flush: true,
        });
        await rename(temp, path);
      } finally {
        await rm(temp, { force: true });
      }
      return result;
    });
    pending = work.catch(() => {});
    return work;
  }
  function item(data: { items: Item[] }, id: string) {
    return (
      data.items.find((value) => value.id === id) ||
      fail("Notebook item not found", 404)
    );
  }
  function title(value: unknown) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 160)
      fail("Title must contain 1–160 characters");
    return (value as string).trim();
  }
  return {
    read,
    create(value: unknown, text: unknown = "") {
      if (typeof text !== "string") fail("Notes must be text");
      return mutate((data) => {
        const valueItem: Item = {
          id: randomUUID(),
          title: title(value),
          text: text as string,
          revision: randomUUID(),
          attachments: [],
        };
        data.items.push(valueItem);
        return valueItem;
      });
    },
    save(
      id: string,
      value: { title?: unknown; text?: unknown; revision?: unknown },
    ) {
      return mutate((data) => {
        const entry = item(data, id);
        if (typeof value.text !== "string") fail("Notes must be text");
        if (entry.revision !== value.revision)
          fail(
            "This item changed in another browser. Your edits are kept here; reload the item before saving again.",
            409,
          );
        entry.title = title(value.title);
        entry.text = value.text as string;
        entry.revision = randomUUID();
        return entry;
      });
    },
    linkJob(id: string, jobId: string, remove = false) {
      if (!/^job_[a-zA-Z0-9_-]{1,160}$/.test(jobId)) fail("Invalid job ID");
      return mutate((data) => {
        const entry = item(data, id);
        const ids = entry.linkedJobIds || [];
        entry.linkedJobIds = remove
          ? ids.filter((value) => value !== jobId)
          : [...new Set([...ids, jobId])];
        return entry;
      });
    },
    async remove(id: string) {
      const files = await mutate((data) => {
        const entry = item(data, id);
        data.items = data.items.filter((value) => value.id !== id);
        return entry.attachments;
      });
      await Promise.all(
        files.map((file) =>
          rm(join(root, "attachments", file.id), { force: true }),
        ),
      );
    },
    async attach(
      id: string,
      name: string,
      bytes: Buffer | AsyncIterable<Uint8Array>,
    ) {
      if (!name.trim() || name.length > 255 || /[\x00-\x1f/\\]/.test(name))
        fail("Invalid attachment filename");
      item(await read(), id);
      const attachment = { id: randomUUID(), name, size: 0 };
      const target = join(root, "attachments", attachment.id);
      try {
        await mkdir(dirname(target), { recursive: true });
        const counter = new Transform({
          transform(chunk, _encoding, callback) {
            attachment.size += chunk.length;
            if (attachment.size > ATTACHMENT_LIMIT)
              callback(
                Object.assign(
                  new Error("Attachments must be 500 MB or smaller"),
                  { status: 413 },
                ),
              );
            else callback(null, chunk);
          },
        });
        await pipeline(
          Readable.from(Buffer.isBuffer(bytes) ? [bytes] : bytes),
          counter,
          createWriteStream(target, { mode: 0o600, flags: "wx" }),
        );
        return await mutate((data) => {
          const entry = item(data, id);
          entry.attachments.push(attachment);
          return entry;
        });
      } catch (error) {
        await rm(target, { force: true });
        throw error;
      }
    },
    async download(id: string, attachmentId: string) {
      const entry = item(await read(), id);
      const attachment =
        entry.attachments.find((value) => value.id === attachmentId) ||
        fail("Attachment not found", 404);
      return {
        ...attachment,
        path: join(root, "attachments", attachment.id),
      };
    },
  };
}
