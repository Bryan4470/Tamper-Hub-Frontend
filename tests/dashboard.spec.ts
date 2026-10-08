import { expect, test } from "@playwright/test";

const sample = {
  id: "dataset_one",
  name: "Validation cards",
  rows: 24,
  labels: { genuine: 12, tamper: 12 },
  version: "abcdef123456",
  missing_images: 0,
};
test.beforeEach(async ({ page }) => {
  await page.route("**/studio-api/v1/**", (route) =>
    route.fulfill({ json: { items: [], roots: [], warnings: [] } }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/health")
      ? { status: "ok", workers: [] }
      : path.endsWith("/system/gpus")
        ? { gpus: [], workers: [] }
        : path.endsWith("/training/configs")
          ? {
              items: [
                {
                  id: "config.yaml",
                  config: {},
                  content:
                    "data:\n  batch_size: 16\nmodel:\n  num_classes: 2\ntraining:\n  epochs: 80\n",
                },
              ],
            }
          : path.endsWith("/dataset-sources")
            ? {
                items: [],
                root_dir: "/mnt5/dataset/tamper/tamper_csv/data/data",
                test_dir:
                  "/mnt5/dataset/tamper/tamper_csv/data/data/testing_dataset",
              }
            : path.endsWith("/datasets")
              ? { items: [sample], total: 1 }
              : { items: [], total: 0, limit: 100, offset: 0 };
    await route.fulfill({ json: data });
  });
});

test("dashboard navigates through every workflow without launching jobs", async ({
  page,
}) => {
  const submissions: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") submissions.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Tamper Hub" }),
  ).toBeVisible();
  await expect(page.getByText("API connected")).toBeVisible();
  await page
    .getByRole("region", { name: "Choose a workspace" })
    .getByRole("button", { name: "Training", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Train a model", exact: true }),
  ).toBeVisible();

  for (const [nav, title] of [
    ["Datasets", "Dataset library"],
    ["Saved results", "Saved results"],
    ["Models", "Model registry"],
    ["Training", "Train a model"],
    ["Inference", "Run inference"],
    ["Evaluation", "Evaluate performance"],
    ["Comparison", "Compare models"],
    ["Job monitor", "Job monitor"],
  ]) {
    await page
      .locator("nav")
      .getByRole("button", { name: nav, exact: false })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  expect(submissions).toEqual([]);
  expect(errors).toEqual([]);
});

test("dataset collection sends selected source paths and shows actionable failures", async ({
  page,
}) => {
  let submitted: unknown;
  const source = {
    id: "source_one",
    name: "genuine.csv",
    path: "/mnt5/data/genuine/mykadfront/genuine.csv",
    relative_path: "genuine/mykadfront/genuine.csv",
    role: "train",
    card_type: "mykadfront",
    default_label: "genuine",
    rows: 20,
    labels: { genuine: 20 },
    configured: true,
  };
  await page.route("**/api/v1/dataset-sources", (route) =>
    route.fulfill({
      json: { items: [source], root_dir: "/mnt5/data", test_dir: "/mnt5/test" },
    }),
  );
  await page.route("**/api/v1/dataset-collections", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 422,
      json: { detail: "Dataset contains duplicate samples" },
    });
  });
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Datasets" }).click();
  await page.getByLabel("Collection name").fill("My training collection");
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Dataset contains duplicate samples",
  );
  expect(submitted).toEqual({
    name: "My training collection",
    source_paths: [source.path],
  });
});

test("saved dataset collections can be deleted without deleting their sources", async ({
  page,
}) => {
  let deleted = "";
  await page.route("**/api/v1/datasets/dataset_one", async (route) => {
    deleted = route.request().method();
    await route.fulfill({ status: 204 });
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Datasets" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByRole("status")).toContainText(
    "Dataset collection deleted",
  );
  expect(deleted).toBe("DELETE");
});

test("mobile navigation and overview fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Tamper Hub" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
