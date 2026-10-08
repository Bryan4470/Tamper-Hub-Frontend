import { expect, test } from "@playwright/test";

test("compare saved checkpoints without submitting jobs", async ({ page }) => {
  const checkpoints = [
    {
      id: "cp_a",
      run_id: "run_a",
      run_name: "August baseline",
      name: "epoch_1.pth",
    },
    {
      id: "cp_b",
      run_id: "run_b",
      run_name: "October candidate",
      name: "epoch_2.pth",
    },
    {
      id: "cp_empty",
      run_id: "run_b",
      run_name: "October candidate",
      name: "epoch_3.pth",
    },
  ];
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      json: { items: [], total: 0, status: "ok", workers: [], gpus: [] },
    }),
  );
  await page.route("**/studio-api/v1/checkpoints", (route) =>
    route.fulfill({ json: { items: checkpoints } }),
  );
  for (const [run, checkpoint, far, frr] of [
    ["run_a", "epoch_1", 0.02, 0.04],
    ["run_b", "epoch_2", 0.01, 0.05],
  ] as const) {
    await page.route(`**/studio-api/v1/runs/${run}/epochs`, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              checkpoint,
              split: "validation",
              epoch: 1,
              metrics: {
                far,
                frr,
                accuracy: 0.95,
                tp: 10,
                tn: 10,
                fp: 1,
                fn: 1,
              },
              metric_source: "Saved validation summary",
              datasets: [],
              predictions: [],
              history: [],
            },
          ],
          warnings: [],
        },
      }),
    );
  }
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") writes++;
  });
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Comparison" }).click();
  await page
    .getByRole("combobox", { name: "Baseline run", exact: true })
    .selectOption("run_a");
  await page
    .getByRole("combobox", { name: "Baseline checkpoint", exact: true })
    .selectOption("cp_a");
  await page.getByRole("button", { name: "Set baseline" }).click();
  await page
    .getByRole("combobox", { name: "Candidate run", exact: true })
    .selectOption("run_b");
  await page
    .getByRole("combobox", { name: "Candidate checkpoint", exact: true })
    .selectOption("cp_empty");
  await expect(
    page.getByRole("button", { name: "Add candidate" }),
  ).toBeDisabled();
  await expect(page.getByText(/No saved validation metrics/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Candidate checkpoint", exact: true })
    .selectOption("cp_b");
  await page.getByRole("button", { name: "Add candidate" }).click();
  const table = page
    .getByRole("table")
    .filter({ hasText: "Saved validation summary" });
  await expect(table).toContainText("August baseline");
  await expect(table).toContainText("October candidate");
  await expect(table).toContainText("-1.00 pp");
  await expect(table).toContainText("+1.00 pp");
  await expect(
    page.getByText(/Dataset membership and thresholds have not been verified/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove epoch_2.pth" }).click();
  await expect(table).not.toContainText("October candidate");
  await page.getByLabel("Comparison split").selectOption("test");
  await expect(
    page.getByRole("heading", { name: "Saved validation comparison" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Baseline checkpoint", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(0);
});
