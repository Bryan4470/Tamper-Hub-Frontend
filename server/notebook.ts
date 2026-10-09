import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function notebookPath() {
  return join(
    process.env.TAMPER_API_WORKSPACE || "/mnt5/dataset/tamper/tamper_hub",
    "notebook",
    "notes.json",
  );
}

export function createNotebookStore(path = notebookPath()) {
  let pending: Promise<unknown> = Promise.resolve();
  async function read(): Promise<{ text: string; revision: string }> {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { text: "", revision: "" };
      throw error;
    }
  }
  function save(text: string, revision: string) {
    const work = pending.then(async () => {
      const current = await read();
      if (current.revision !== revision)
        throw Object.assign(
          new Error(
            "Notes changed in another browser. Copy your edits, then reload before saving.",
          ),
          { status: 409 },
        );
      const value = { text, revision: randomUUID() };
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(value, null, 2), {
          mode: 0o600,
          flush: true,
        });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
      return value;
    });
    pending = work.catch(() => {});
    return work;
  }
  return { read, save };
}
