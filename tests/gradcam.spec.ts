import { expect, test } from "@playwright/test";

test("Grad-CAM selects checkpoint, submits explicitly, and displays output", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (
      url.pathname.endsWith("/gradcam-runs") &&
      route.request().method() === "POST"
    ) {
      submissions++;
      expect(route.request().postDataJSON()).toMatchObject({
        checkpoint_path: "/runs/demo/checkpoints/epoch_1.pth",
        input_path: "/images/card.png",
        input_type: "image",
        card_type: "mykadback",
        limit: 50,
        output_root: "/outputs",
        output_prefix: "review",
      });
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      return route.fulfill({
        status: 202,
        json: { resource_id: "gradcam_1", job_id: "job_1" },
      });
    }
    if (url.pathname.endsWith("/gradcam-runs/gradcam_1"))
      return route.fulfill({
        json: {
          id: "gradcam_1",
          status: "succeeded",
          phase: "Complete",
          job_id: "job_1",
          checkpoint_path: "/runs/demo/checkpoints/epoch_1.pth",
          items: [
            {
              image_path: "/images/card.png",
              artifact_id: "art_1",
              prediction: "tampered",
              prob_tampered: 0.8,
              prob_genuine: 0.2,
              threshold: 0.5,
              card_type: "mykadback",
            },
          ],
        },
      });
    if (url.pathname.endsWith("/artifacts/art_1/download"))
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    return route.fulfill({
      json: { items: [], total: 0, status: "ok", workers: [], gpus: [] },
    });
  });
  await page.route("**/studio-api/v1/checkpoints", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "cp_1",
            run_id: "run_1",
            run_name: "Demo training",
            name: "epoch_1.pth",
            checkpoint_path: "/runs/demo/checkpoints/epoch_1.pth",
            config_path: "/runs/demo/config.yaml",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Grad-CAM", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Generate Grad-CAM" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("combobox", { name: "Checkpoint source", exact: true })
      .locator("option"),
  ).toHaveText(["Choose a saved checkpoint", "Enter a checkpoint path"]);
  expect(
    await page
      .getByRole("combobox", { name: "Saved checkpoint", exact: true })
      .locator("optgroup")
      .evaluateAll((groups) =>
        groups.map((group) => group.getAttribute("label")),
      ),
  ).toEqual(["Models", "Training checkpoints"]);
  expect(submissions).toBe(0);
  await page
    .getByRole("combobox", { name: "Saved checkpoint", exact: true })
    .selectOption("checkpoint:/runs/demo/checkpoints/epoch_1.pth");
  await page
    .getByLabel("Server input path", { exact: true })
    .fill("/images/card.png");
  await page
    .getByRole("combobox", { name: "Card type", exact: true })
    .selectOption("mykadback");
  await page
    .getByRole("textbox", { name: /^Output location on server/ })
    .fill("/outputs");
  await page
    .getByRole("textbox", { name: /^Output folder name/ })
    .fill("review");
  expect(submissions).toBe(0);
  await page
    .getByRole("button", { name: "Generate visualization", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download visualization" }),
  ).toBeVisible();
  await expect(page.getByText(/Tamper 80/)).toBeVisible();
  expect(submissions).toBe(1);
  await expect(page.getByRole("form", { name: "Grad-CAM" })).toBeHidden();
  await page.getByRole("button", { name: "Back to Grad-CAM runs" }).click();
  await expect(page.getByRole("form", { name: "Grad-CAM" })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Saved checkpoint", exact: true }),
  ).toHaveValue("checkpoint:/runs/demo/checkpoints/epoch_1.pth");
  await expect(page.getByText("1 Choose a checkpoint")).toBeVisible();
  await expect(page.getByText("2 Choose your input")).toBeVisible();
  await expect(page.getByText("3 Run and save results")).toBeVisible();
  expect(submissions).toBe(1);
});

test("Grad-CAM upload uses multipart and displays submission errors", async ({
  page,
}) => {
  let uploads = 0;
  await page.route("**/api/v1/**", (route) => {
    if (route.request().url().endsWith("/gradcam-runs/upload")) {
      uploads++;
      expect(route.request().headers()["content-type"]).toContain(
        "multipart/form-data",
      );
      expect(route.request().postData()).toContain('name="file"');
      return route.fulfill({
        status: 422,
        json: { detail: "Checkpoint cannot be loaded" },
      });
    }
    if (route.request().url().includes("/models?"))
      return route.fulfill({
        json: {
          items: [{ id: "model_1", name: "Registered model" }],
          total: 1,
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
    .getByRole("button", { name: "Grad-CAM", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Input source", exact: true })
    .selectOption("upload");
  await page
    .getByRole("combobox", { name: "Saved checkpoint", exact: true })
    .selectOption("model:model_1");
  await page.getByLabel(/^Or upload image/).setInputFiles({
    name: "card.png",
    mimeType: "image/png",
    buffer: Buffer.from("mock image"),
  });
  expect(uploads).toBe(0);
  await page
    .getByRole("button", { name: "Generate visualization", exact: true })
    .click();
  await expect(page.getByText("Checkpoint cannot be loaded")).toBeVisible();
  expect(uploads).toBe(1);
});

test("Grad-CAM run table opens results and deletes terminal runs", async ({
  page,
}) => {
  let deleted = false;
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "DELETE") {
      expect(path).toBe("/api/v1/jobs/job_saved");
      deleted = true;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/gradcam-runs"))
      return route.fulfill({
        json: {
          items: deleted
            ? []
            : [
                {
                  id: "gradcam_saved",
                  name: "Saved explanation",
                  job_id: "job_saved",
                  status: "succeeded",
                  total: 2,
                  failures: 0,
                },
              ],
          total: deleted ? 0 : 1,
        },
      });
    if (path.endsWith("/gradcam-runs/gradcam_saved"))
      return route.fulfill({
        json: {
          name: "Saved explanation",
          status: "succeeded",
          total: 2,
          failures: 0,
          items: [],
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
    .getByRole("button", { name: "Grad-CAM", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Saved explanation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved explanation", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("form", { name: "Grad-CAM" })).toBeHidden();
  await page.getByRole("button", { name: "Back to Grad-CAM runs" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete run Saved explanation", exact: true })
    .click();
  await expect(page.getByText("No Grad-CAM runs yet")).toBeVisible();
  expect(deleted).toBe(true);
});

test("Grad-CAM uploads a folder with subfolders", async ({ page }) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const folder = await mkdtemp(join(tmpdir(), "gradcam-folder-"));
  let submitted = 0;
  try {
    await mkdir(join(folder, "nested"));
    await writeFile(join(folder, "a.png"), "fixture");
    await writeFile(join(folder, "nested", "a.png"), "nested fixture");
    await writeFile(join(folder, "notes.txt"), "ignored");
    await page.route("**/api/v1/**", (route) => {
      if (route.request().url().endsWith("/gradcam-runs/uploads")) {
        submitted++;
        const body = route.request().postData() || "";
        expect(body).toContain("/nested/a.png");
        expect(body).toContain('name="files"');
        expect(body).not.toContain("notes.txt");
        expect(route.request().headers()["idempotency-key"]).toBeTruthy();
        return route.fulfill({
          status: 202,
          json: { resource_id: "gradcam_folder" },
        });
      }
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
      .getByRole("button", { name: "Grad-CAM", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Checkpoint source", exact: true })
      .selectOption("path");
    await page
      .getByLabel("Checkpoint file", { exact: true })
      .fill("/models/checkpoint.pth");
    await page
      .getByRole("combobox", { name: "Input source", exact: true })
      .selectOption("folder");
    await expect(
      page.getByRole("button", { name: "Generate visualization", exact: true }),
    ).toBeDisabled();
    await page.getByLabel(/^Upload image folder/).setInputFiles(folder);
    await expect(page.getByText(/2 images selected/)).toBeVisible();
    await expect(page.getByText("Skipped 1 non-image files.")).toBeVisible();
    expect(submitted).toBe(0);
    await page
      .getByRole("button", { name: "Generate visualization", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Back to Grad-CAM runs" }),
    ).toBeVisible();
    expect(submitted).toBe(1);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
