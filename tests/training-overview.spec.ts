import { expect, test } from "@playwright/test";

test("saved training overview shows recorded timings and missing timestamps", async ({
  page,
}) => {
  const run = {
    id: "run_overview",
    name: "August training overview",
    kind: "training",
    status: "completed",
    directory: "/runs/august",
    modified: "2026-10-08",
    error: "",
  };
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") writes++;
  });
  await page.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("/training-overview?")) {
      expect(new URL(route.request().url()).searchParams.get("path")).toBe(
        "/runs/august",
      );
      return route.fulfill({
        json: {
          facts: [
            { label: "Completed epochs", value: 60 },
            { label: "Configured epochs", value: 80 },
            { label: "Backbone", value: "efficientnet_b3" },
            { label: "Image size", value: 1024 },
            { label: "Batch size", value: 16 },
          ],
          timestamps: { created_at: null, started_at: null, finished_at: null },
          elapsed_seconds: null,
          timing: {
            totals: {
              overall_seconds: 51662.678,
              train_seconds: 40987.768,
              val_seconds: 5410.05,
              test_seconds: 5264.86,
            },
            epochs: [
              {
                epoch: 1,
                train_seconds: 60,
                val_seconds: 10,
                total_seconds: 70,
              },
            ],
          },
          split_counts: { train: 39947, val: 9987, test: 9932 },
          sources: ["config.yaml", "logs/timing_summary.json"],
          warnings: [],
        },
      });
    }
    return route.fulfill({
      json: { items: [], total: 0, status: "ok", workers: [], gpus: [] },
    });
  });
  await page.route("**/studio-api/v1/runs", (route) =>
    route.fulfill({ json: { items: [run], roots: [], warnings: [] } }),
  );
  await page.route("**/studio-api/v1/runs/run_overview", (route) =>
    route.fulfill({
      json: { run, artifacts: [], history: [], metrics: {}, warnings: [] },
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Saved results", exact: true })
    .click();
  await page.getByRole("button", { name: /August training overview/ }).click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  const overview = page.getByRole("region", {
    name: "Training overview",
    exact: true,
  });
  await expect(overview.getByText("14h 21m 3s", { exact: true })).toBeVisible();
  await expect(overview.getByText("39,947", { exact: true })).toBeVisible();
  await expect(overview.getByText(/not elapsed wall time/)).toBeVisible();
  await expect(
    overview.getByText("Elapsed wall time (start to finish)").locator(".."),
  ).toContainText("Not recorded");
  await overview
    .getByText("Per-epoch timing (1 epochs)", { exact: true })
    .click();
  await expect(
    overview.getByRole("table").filter({ hasText: "Recorded total" }),
  ).toContainText("0h 1m 10s");
  await page.getByRole("tab", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No result files yet" }),
  ).toBeVisible();
  expect(writes).toBe(0);
});
