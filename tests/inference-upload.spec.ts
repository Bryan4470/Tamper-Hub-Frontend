import { expect, test } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const mode of ["images", "folder"] as const) {
  test(`inference accepts local ${mode} and submits only on click`, async ({
    page,
  }) => {
    let submissions = 0;
    let multipart = "";
    await page.route("**/api/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/inference-runs/upload")) {
        submissions++;
        multipart = route.request().postData() || "";
        expect(route.request().headers()["content-type"]).toContain(
          "multipart/form-data",
        );
        expect(route.request().headers()["idempotency-key"]).toBeTruthy();
        return route.fulfill({
          status: 202,
          json: { resource_id: "inference_upload" },
        });
      }
      if (path.endsWith("/inference-runs/inference_upload"))
        return route.fulfill({
          json: {
            id: "inference_upload",
            name: "Uploaded images",
            status: "queued",
            request: {},
          },
        });
      return route.fulfill({
        json: { items: [], total: 0, status: "ok", workers: [], gpus: [] },
      });
    });
    await page.route("**/studio-api/v1/checkpoints", (route) =>
      route.fulfill({ json: { items: [] } }),
    );
    await page.goto("/");
    await page
      .locator("nav")
      .getByRole("button", { name: "Inference", exact: true })
      .click();
    const form = page.getByRole("form", { name: "Direct inference" });
    await form
      .getByRole("combobox", { name: "Checkpoint source", exact: true })
      .selectOption("path");
    await form
      .getByLabel("Checkpoint file", { exact: true })
      .fill("/models/checkpoint.pth");
    await form
      .getByRole("combobox", { name: "Input source", exact: true })
      .selectOption(mode);
    await expect(form.getByLabel("Input path on server")).toHaveCount(0);
    let folder = "";
    try {
      if (mode === "folder") {
        folder = await mkdtemp(join(tmpdir(), "hub-upload-"));
        await mkdir(join(folder, "nested"));
        await writeFile(join(folder, "card.png"), "image fixture");
        await writeFile(
          join(folder, "nested", "card.png"),
          "nested image fixture",
        );
        await writeFile(join(folder, "notes.txt"), "ignored");
        await form.getByLabel(/^Upload image folder/).setInputFiles(folder);
        await expect(
          form.getByText("Skipped 1 non-image files."),
        ).toBeVisible();
        await expect(form.getByText(/2 images selected/)).toBeVisible();
      } else {
        await form.getByLabel(/^Upload images/).setInputFiles({
          name: "card.png",
          mimeType: "image/png",
          buffer: Buffer.from("image fixture"),
        });
        await expect(form.getByText(/1 images selected/)).toBeVisible();
      }
      expect(submissions).toBe(0);
      await form
        .getByRole("button", { name: "Run inference", exact: true })
        .click();
      await expect(page.getByText("Inference queued.")).toBeVisible();
      expect(submissions).toBe(1);
      expect(multipart).toContain('name="files"');
      expect(multipart).toContain("/models/checkpoint.pth");
      if (mode === "folder") {
        expect(multipart).toContain("/nested/card.png");
        expect(multipart).not.toContain("notes.txt");
      }
    } finally {
      if (folder) await rm(folder, { recursive: true, force: true });
    }
  });
}

test("switching upload source clears files and submission errors retain selection", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill(
      route.request().method() === "POST"
        ? { status: 422, json: { detail: "Image could not be decoded" } }
        : {
            json: { items: [], total: 0, status: "ok", workers: [], gpus: [] },
          },
    ),
  );
  await page.route("**/studio-api/v1/checkpoints", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Inference", exact: true })
    .click();
  const form = page.getByRole("form", { name: "Direct inference" });
  await form
    .getByRole("combobox", { name: "Checkpoint source", exact: true })
    .selectOption("path");
  await form
    .getByLabel("Checkpoint file", { exact: true })
    .fill("/models/checkpoint.pth");
  await form
    .getByRole("combobox", { name: "Input source", exact: true })
    .selectOption("images");
  await form.getByLabel(/^Upload images/).setInputFiles({
    name: "card.png",
    mimeType: "image/png",
    buffer: Buffer.from("fixture"),
  });
  await form
    .getByRole("button", { name: "Run inference", exact: true })
    .click();
  await expect(form.getByText("Image could not be decoded")).toBeVisible();
  await expect(form.getByText(/1 images selected/)).toBeVisible();
  await form
    .getByRole("combobox", { name: "Input source", exact: true })
    .selectOption("folder");
  await expect(
    form.getByRole("button", { name: "Run inference", exact: true }),
  ).toBeDisabled();
});
