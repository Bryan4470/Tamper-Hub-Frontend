import { expect, test } from "@playwright/test";
import type { NotebookItem } from "../src/api/notebookTypes";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ json: { status: "ok", items: [], gpus: [], workers: [] } }),
  );
  await page.route("**/studio-api/v1/**", (route) =>
    route.fulfill({ json: { items: [], roots: [], warnings: [] } }),
  );
});

test("notebook items keep independent notes and downloadable PDF and Excel attachments", async ({
  page,
}) => {
  const items: NotebookItem[] = [
    {
      id: "legacy",
      title: "Future updates",
      text: "Existing notes",
      revision: "r1",
      attachments: [],
    },
  ];
  const uploaded = new Map<string, Buffer>();
  await page.route("**/studio-api/v1/notebook/items**", async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/").slice(5);
    const method = route.request().method();
    if (!segments.length) {
      if (method === "POST") {
        const item = {
          id: `item${items.length}`,
          title: route.request().postDataJSON().title,
          text: route.request().postDataJSON().text || "",
          revision: "r1",
          attachments: [],
        };
        items.push(item);
        await route.fulfill({ json: item });
      } else await route.fulfill({ json: { items } });
      return;
    }
    const item = items.find((value) => value.id === segments[0])!;
    if (segments[1] === "attachments") {
      if (method === "POST") {
        const id = `file${uploaded.size}`;
        const bytes = route.request().postDataBuffer()!;
        uploaded.set(id, bytes);
        item.attachments.push({
          id,
          name: url.searchParams.get("name")!,
          size: bytes.length,
        });
        await route.fulfill({ json: item });
      } else
        await route.fulfill({
          contentType: "application/octet-stream",
          body: uploaded.get(segments[2])!,
        });
      return;
    }
    if (method === "DELETE") {
      items.splice(items.indexOf(item), 1);
      await route.fulfill({ status: 204 });
      return;
    }
    Object.assign(item, route.request().postDataJSON(), {
      revision: `r${Date.now()}`,
    });
    await route.fulfill({ json: item });
  });
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await expect(page.getByLabel("Your notes")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/notebook-list.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add notebook item" }),
  ).toBeVisible();
  await page.getByLabel("Item title").fill("Experiment report");
  await page.getByLabel("Your notes").fill("PDF and spreadsheet findings");
  await page.screenshot({
    path: "output/playwright/notebook-create.png",
    fullPage: true,
  });
  await page.getByLabel("Attachments", { exact: false }).setInputFiles([
    {
      name: "report.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF sample"),
    },
    {
      name: "measurements.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.alloc(21 * 1024 * 1024, 0x50),
    },
  ]);
  expect(items).toHaveLength(1);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /Experiment report.*2 attachments/ })
    .click();
  await expect(
    page.getByRole("button", { name: "measurements.xlsx", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "report.pdf", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("report.pdf");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: /Future updates.*0 attachments/ })
    .click();
  await expect(page.getByLabel("Your notes")).toHaveValue("Existing notes");
  await expect(
    page.getByRole("button", { name: "report.pdf", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page
    .getByRole("button", { name: /Experiment report.*2 attachments/ })
    .click();
  await expect(page.getByLabel("Your notes")).toHaveValue(
    "PDF and spreadsheet findings",
  );
  await expect(
    page.getByRole("button", { name: "measurements.xlsx", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Experiment report", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /Future updates.*0 attachments/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Experiment report.*attachments/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Your notes")).toHaveValue("Existing notes");
});

test("failed saves keep edits and browser drafts can be recovered per item", async ({
  page,
}) => {
  const item = {
    id: "legacy",
    title: "Future updates",
    text: "Saved text",
    revision: "r1",
    attachments: [],
  };
  await page.route("**/studio-api/v1/notebook/items", (route) =>
    route.fulfill({ json: { items: [item] } }),
  );
  await page.route("**/studio-api/v1/notebook/items/legacy", (route) =>
    route.fulfill({
      status: 409,
      json: { detail: "Notes changed in another browser" },
    }),
  );
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page
    .getByRole("button", { name: /Future updates.*0 attachments/ })
    .click();
  await page.getByLabel("Your notes").fill("Keep my unsaved edits");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("another browser");
  await expect(page.getByLabel("Your notes")).toHaveValue(
    "Keep my unsaved edits",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page
    .getByRole("button", { name: /Future updates.*0 attachments/ })
    .click();
  await page.getByRole("button", { name: "Restore browser draft" }).click();
  await expect(page.getByLabel("Your notes")).toHaveValue(
    "Keep my unsaved edits",
  );
});

test("creation popup cancels without writing and retries failed files without duplicate items", async ({
  page,
}) => {
  let creates = 0;
  let attempts = 0;
  const item: NotebookItem = {
    id: "new",
    title: "Retry example",
    text: "Notes",
    revision: "1",
    attachments: [],
  };
  await page.route("**/studio-api/v1/notebook/items", async (route) => {
    if (route.request().method() === "POST") {
      creates++;
      await route.fulfill({ json: item });
    } else await route.fulfill({ json: { items: [] } });
  });
  await page.route(
    "**/studio-api/v1/notebook/items/new/attachments?*",
    async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.fulfill({ status: 500, json: { detail: "Upload failed" } });
        return;
      }
      await route.fulfill({
        json: {
          ...item,
          attachments: [{ id: "f", name: "report.pdf", size: 4 }],
        },
      });
    },
  );
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item title").fill("Cancelled");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(creates).toBe(0);
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item title").fill("Retry example");
  await page.getByLabel("Your notes").fill("Notes");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/notebook-create-mobile.png",
    fullPage: true,
  });
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.width).toBeLessThanOrEqual(390);
  await page.getByLabel("Attachments", { exact: false }).setInputFiles({
    name: "report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("test"),
  });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Upload failed");
  await page.getByRole("button", { name: "Retry attachments" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(creates).toBe(1);
  expect(attempts).toBe(2);
});

test("notebook links jobs by dropdown, preserves notes, opens jobs and unlinks", async ({
  page,
}) => {
  const item: NotebookItem = {
    id: "legacy",
    title: "My note",
    text: "Keep these notes",
    revision: "1",
    attachments: [],
    linkedJobIds: [],
  };
  const job = {
    id: "job_example",
    name: "Inference experiment",
    kind: "inference",
    status: "succeeded",
    resource_id: "inference_example",
    progress: 1,
  };
  await page.route("**/studio-api/v1/notebook/items", (route) =>
    route.fulfill({ json: { items: [item] } }),
  );
  await page.route(
    "**/studio-api/v1/notebook/items/legacy/jobs/job_example",
    async (route) => {
      item.linkedJobIds = route.request().method() === "POST" ? [job.id] : [];
      await route.fulfill({ json: item });
    },
  );
  await page.route("**/api/v1/jobs?*", (route) =>
    route.fulfill({ json: { items: [job], total: 1, offset: 0, limit: 100 } }),
  );
  await page.route("**/api/v1/jobs/job_example", (route) =>
    route.fulfill({ json: job }),
  );
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page.getByRole("button", { name: /My note.*0 attachments/ }).click();
  const links = page.getByRole("region", { name: "Linked jobs for My note" });
  await links.getByRole("button", { name: "Add jobs", exact: true }).click();
  await links.getByRole("combobox").selectOption("job_example");
  await links.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    links.getByRole("button", { name: "Inference experiment", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Your notes")).toHaveValue("Keep these notes");
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page.getByRole("button", { name: /My note.*0 attachments/ }).click();
  await links
    .getByRole("button", { name: "Inference experiment", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "All jobs" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inference experiment", exact: true }),
  ).toBeVisible();
  await page.locator("nav").getByRole("button", { name: "Notebook" }).click();
  await page.getByRole("button", { name: /My note.*0 attachments/ }).click();
  await links
    .getByRole("button", { name: "Unlink Inference experiment" })
    .click();
  await expect(links.getByText("No linked jobs")).toBeVisible();
  await expect(page.getByLabel("Your notes")).toHaveValue("Keep these notes");
});
