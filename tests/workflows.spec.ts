import { expect, test, type Page } from "@playwright/test";

const dataset = {
  id: "dataset_one",
  name: "Validation cards",
  rows: 24,
  labels: { genuine: 12, tamper: 12 },
  version: "abcdef123456",
  missing_images: 0,
  source_path: "/data/train.csv",
  dataset_role: "train",
};
const model = { id: "model_one", name: "Baseline model" };
const configYaml =
  "data:\n  batch_size: 16\nmodel:\n  num_classes: 2\ntraining:\n  epochs: 80\n";
const config = {
  data: { batch_size: 16, image_size: 1024, num_workers: 4, val_split: 0.2 },
  model: { pretrained: true },
  training: {
    epochs: 80,
    learning_rate: 0.0003,
    optimizer: "adamw",
    gradient_accumulation_steps: 1,
    early_stopping: { enabled: true, patience: 10 },
  },
  augmentation: { enabled: true },
};
const collection = (items: unknown[] = []) => ({
  items,
  total: items.length,
  limit: 100,
  offset: 0,
});

async function openPage(page: Page, name: string) {
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/studio-api/v1/checkpoints", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    // Every request is intercepted: these tests never reach the real job queue.
    if (route.request().method() !== "GET") {
      await route.fulfill({
        status: 500,
        json: { detail: "Unexpected submission" },
      });
      return;
    }
    const data = path.endsWith("/health")
      ? { status: "ok", workers: [] }
      : path.endsWith("/system/gpus")
        ? { gpus: [], workers: [] }
        : path.endsWith("/training/configs")
          ? {
              ...collection([
                { id: "config.yaml", config, content: configYaml },
              ]),
              output_root: "/mnt5/dataset/tamper/tamper_hub/checkpoints",
            }
          : path.endsWith("/dataset-sources")
            ? {
                items: [
                  {
                    id: "source_train",
                    name: "train.csv",
                    path: "/data/train.csv",
                    relative_path: "train.csv",
                    role: "train",
                    card_type: "mykadfront",
                    labels: { genuine: 12, tamper: 12 },
                    rows: 24,
                    configured: true,
                  },
                ],
                root_dir: "/data",
                test_dir: "/data/test",
              }
            : path.endsWith("/datasets")
              ? collection([dataset])
              : path.endsWith("/models")
                ? collection([model])
                : path.endsWith("/checkpoints")
                  ? []
                  : collection();
    await route.fulfill({ json: data });
  });
});

test("saved collections show their assigned CSVs when selected", async ({
  page,
}) => {
  await page.route("**/api/v1/datasets?**", (route) =>
    route.fulfill({
      json: collection([
        dataset,
        {
          ...dataset,
          id: "dataset_collection",
          name: "Combined training",
          source_path: null,
          source_paths: ["/data/genuine/cards.csv", "/data/tamper/cards.csv"],
        },
        {
          ...dataset,
          id: "dataset_unknown",
          name: "Missing sources",
          source_path: null,
        },
      ]),
    }),
  );
  await openPage(page, "Datasets");
  const sources = page.getByRole("list", { name: "Collection CSV files" });
  await expect(sources).toHaveCount(0);
  await page.getByRole("button", { name: /Combined training/ }).click();
  await expect(sources.getByRole("listitem")).toHaveCount(2);
  await expect(sources).toContainText("/data/genuine/cards.csv");
  await expect(sources).toContainText("/data/tamper/cards.csv");
  await page.getByRole("button", { name: /Validation cards/ }).click();
  await expect(sources.getByRole("listitem")).toHaveCount(1);
  await expect(sources).toContainText("/data/train.csv");
  await expect(sources).not.toContainText("/data/genuine/cards.csv");
  await page.getByRole("button", { name: /Missing sources/ }).click();
  await expect(sources).toHaveCount(0);
  await expect(page.getByText("No source CSVs recorded")).toBeVisible();
});

test("training preflight and submission use the same form values", async ({
  page,
}) => {
  let preflight: unknown;
  let submitted: unknown;
  await page.route("**/api/v1/training/validate", async (route) => {
    preflight = route.request().postDataJSON();
    await route.fulfill({
      json: { valid: true, split_counts: { train: 18, val: 6, test: 0 } },
    });
  });
  await page.route("**/api/v1/training-runs", async (route) => {
    submitted = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      status: 202,
      json: { resource_id: "training_new", job_id: "job_new" },
    });
  });
  await page.route("**/api/v1/training-runs/training_new", (route) =>
    route.fulfill({
      json: {
        id: "training_new",
        name: "Refactor experiment",
        status: "queued",
        job_id: "job_new",
      },
    }),
  );
  await openPage(page, "Training");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Use datasets from config")).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Experiment name").fill("Refactor experiment");
  await expect(page.getByLabel("Output location on server")).toHaveValue(
    "/mnt5/dataset/tamper/tamper_hub/checkpoints",
  );
  await page
    .getByLabel("Output location on server")
    .fill("/mnt5/dataset/tamper/custom-training");
  await page.getByRole("button", { name: "Use default location" }).click();
  await expect(page.getByLabel("Output location on server")).toHaveValue(
    "/mnt5/dataset/tamper/tamper_hub/checkpoints",
  );
  await page
    .getByLabel("Output location on server")
    .fill("/mnt5/dataset/tamper/custom-training");
  await page.getByRole("spinbutton", { name: /^Epochs/ }).fill("2");
  await page.getByRole("button", { name: "Continue" }).click();
  expect(submitted).toBeUndefined();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByLabel("Experiment name")).toHaveValue(
    "Refactor experiment",
  );
  await expect(page.getByRole("spinbutton", { name: /^Epochs/ })).toHaveValue(
    "2",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Validate configuration" }).click();
  await expect(
    page.getByText("Ready: 18 training, 6 validation, 0 test samples."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(
    page.getByRole("heading", { name: "Refactor experiment", exact: true }),
  ).toBeVisible();
  expect(submitted).toEqual(preflight);
  expect(submitted).toEqual({
    name: "Refactor experiment",
    output_root: "/mnt5/dataset/tamper/custom-training",
    config_id: "config.yaml",
    train_dataset_ids: [dataset.id],
    validation_dataset_ids: [],
    test_dataset_ids: [],
    device: "cpu",
    config_yaml: configYaml,
    overrides: { "training.epochs": 2 },
  });
});

test("training defaults to the dataset collection selected by config.yaml", async ({
  page,
}) => {
  const configuredPaths = ["/data/genuine.csv", "/data/tamper.csv"];
  await page.route("**/api/v1/dataset-sources", (route) =>
    route.fulfill({
      json: {
        items: configuredPaths.map((path) => ({
          path,
          role: "train",
          configured: true,
        })),
        root_dir: "/data",
        test_dir: "/data/test",
      },
    }),
  );
  await page.route("**/api/v1/datasets?**", (route) =>
    route.fulfill({
      json: collection([
        { ...dataset, source_paths: configuredPaths, dataset_role: "train" },
      ]),
    }),
  );

  await openPage(page, "Training");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("radio", { name: /^Use datasets from config/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: /^Use datasets from config/ }),
  ).toHaveAccessibleName(/Training: 2 CSVs/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Configuration template")).toHaveValue(
    "config.yaml",
  );
  await expect(page.getByRole("spinbutton", { name: /^Epochs/ })).toHaveValue(
    "80",
  );
});

test("custom dataset selection shows configured CSV checkboxes by default", async ({
  page,
}) => {
  const configuredPaths = ["/data/genuine.csv", "/data/tamper.csv"];
  await page.route("**/api/v1/dataset-sources", (route) =>
    route.fulfill({
      json: {
        items: configuredPaths.map((path) => ({
          path,
          role: "train",
          configured: true,
        })),
        root_dir: "/data",
        test_dir: "/data/test",
      },
    }),
  );
  await page.route("**/api/v1/datasets?**", (route) =>
    route.fulfill({
      json: collection([
        {
          ...dataset,
          id: "genuine_old",
          name: "Genuine old",
          source_path: configuredPaths[0],
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          ...dataset,
          id: "genuine_new",
          name: "Genuine new",
          source_path: configuredPaths[0],
          created_at: "2026-09-01T00:00:00Z",
        },
        {
          ...dataset,
          id: "tamper_new",
          name: "Tamper new",
          source_path: configuredPaths[1],
          created_at: "2026-09-01T00:00:00Z",
        },
      ]),
    }),
  );

  await openPage(page, "Training");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Custom selection").check();
  await expect(
    page.getByRole("group", { name: "Training CSVs" }).getByRole("checkbox"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("checkbox", { name: /genuine.csv/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /tamper.csv/ }),
  ).toBeChecked();
});

test("registered models and compute settings are used by batch inference", async ({
  page,
}) => {
  const newModel = { id: "model_new", name: "Candidate model" };
  let registered = false;
  let batch: unknown;
  await page.route("**/api/v1/models**", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        name: newModel.name,
        remark: "",
        checkpoint_path: "/models/best.pth",
        config_path: "/models/config.yaml",
      });
      registered = true;
      await route.fulfill({ status: 201, json: newModel });
    } else
      await route.fulfill({
        json: collection(registered ? [model, newModel] : [model]),
      });
  });
  await page.route("**/api/v1/inference-runs", async (route) => {
    batch = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: { resource_id: "inference_new" },
    });
  });
  await openPage(page, "Models");
  await page.getByText("Register a model checkpoint", { exact: false }).click();
  await page.getByLabel("Model name", { exact: true }).fill(newModel.name);
  await page
    .getByLabel("Checkpoint path", { exact: true })
    .fill("/models/best.pth");
  await page
    .getByLabel("Model configuration path", { exact: true })
    .fill("/models/config.yaml");
  await page
    .getByRole("button", { name: "Register model", exact: true })
    .click();
  await page.getByRole("button", { name: /Candidate model/ }).click();
  await page.getByText("Registered datasets", { exact: true }).click();
  await expect(
    page
      .getByRole("group", { name: "Model checkpoints" })
      .getByRole("checkbox", { name: /Candidate model/ }),
  ).toBeChecked();
  await page
    .getByRole("group", { name: "Input datasets" })
    .getByRole("checkbox")
    .check();
  await page.getByLabel("Crop original images before inference").check();
  await page.getByRole("button", { name: "Run batch inference" }).click();
  await expect(page.getByText("Batch inference queued.")).toBeVisible();
  expect(batch).toEqual({
    name: "Benchmark inference",
    model_ids: [newModel.id],
    dataset_ids: [dataset.id],
    device: "cpu",
    crop: true,
    batch_size: 16,
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Models", exact: true })
    .click();
  await page.getByRole("button", { name: /Candidate model/ }).click();
  await page.getByText("Registered datasets", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Run inference", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Model checkpoints" })
      .getByRole("checkbox", { name: /Candidate model/ }),
  ).toBeChecked();
});

test("imported predictions and tuned thresholds feed the evaluation form", async ({
  page,
}) => {
  let imported = false;
  let tuned = false;
  let submitted: unknown;
  const artifact = {
    id: "artifact_imported",
    kind: "predictions",
    model_id: model.id,
    dataset_id: dataset.id,
    filename: "predictions.csv",
  };
  await page.route("**/api/v1/artifacts?**", (route) =>
    route.fulfill({ json: collection(imported ? [artifact] : []) }),
  );
  await page.route("**/api/v1/artifacts/import-predictions", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      path: "/predictions.csv",
      model_id: model.id,
      dataset_id: dataset.id,
    });
    imported = true;
    await route.fulfill({ status: 201, json: artifact });
  });
  await page.route("**/api/v1/threshold-sweeps?**", (route) =>
    route.fulfill({
      json: collection(
        tuned
          ? [{ id: "sweep_new", name: "Threshold sweep", status: "succeeded" }]
          : [],
      ),
    }),
  );
  await page.route("**/api/v1/threshold-sweeps", async (route) => {
    expect(route.request().postDataJSON().prediction_artifact_ids).toEqual([
      artifact.id,
    ]);
    tuned = true;
    await route.fulfill({ status: 202, json: { resource_id: "sweep_new" } });
  });
  await page.route("**/api/v1/threshold-sweeps/sweep_new", (route) =>
    route.fulfill({
      json: {
        status: "succeeded",
        result: {
          selection_policy: "Test threshold policy",
          recommendations: {
            mykadfront: { threshold: 0.72, far: 0, frr: 0.1 },
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/evaluations", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: { resource_id: "evaluation_new" },
    });
  });
  await openPage(page, "Evaluation");
  await page
    .getByText("Import existing prediction CSVs", { exact: true })
    .click();
  await page.getByLabel("Prediction CSV path").fill("/predictions.csv");
  await page
    .getByRole("combobox", { name: "Source dataset", exact: true })
    .selectOption(dataset.id);
  await page
    .getByRole("button", { name: "Import predictions", exact: true })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Prediction artifacts" })
      .getByRole("checkbox"),
  ).toBeChecked();
  await page.getByRole("button", { name: /Tune thresholds/ }).click();
  await page.getByRole("button", { name: "Apply to evaluation form" }).click();
  await expect(page.getByLabel("MyKad front threshold")).toHaveValue("0.72");
  await page.getByRole("button", { name: /Run evaluation/ }).click();
  await expect(
    page.getByText("Evaluation queued on the CPU worker."),
  ).toBeVisible();
  expect(submitted).toEqual({
    name: "Benchmark evaluation",
    prediction_artifact_ids: [artifact.id],
    ground_truth_dataset_ids: [],
    thresholds: { mykadfront: 0.72, mykadback: 0.5 },
  });
});

test("comparison keeps policies and shows incompatible evidence", async ({
  page,
}) => {
  let submitted: unknown;
  await page.route("**/api/v1/evaluations?**", (route) =>
    route.fulfill({
      json: collection([
        { id: "evaluation_base", name: "Baseline", status: "succeeded" },
        { id: "evaluation_candidate", name: "Candidate", status: "succeeded" },
      ]),
    }),
  );
  await page.route("**/api/v1/comparisons", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: { resource_id: "comparison_new" },
    });
  });
  await page.route("**/api/v1/comparisons/comparison_new", (route) =>
    route.fulfill({
      json: {
        status: "succeeded",
        result: {
          comparable: false,
          reasons: ["Ground truth differs"],
          rows: [],
          ranking: [],
          metric: "frr",
          coverage_policy: "intersection",
          threshold_policy: "per_evaluation",
        },
      },
    }),
  );
  await openPage(page, "Comparison");
  await page.getByLabel("Baseline evaluation").selectOption("evaluation_base");
  await page
    .getByRole("group", { name: "Candidate evaluations" })
    .getByRole("checkbox")
    .check();
  await page.getByLabel("Sample coverage").selectOption("intersection");
  await page.getByLabel("Threshold policy").selectOption("per_evaluation");
  await page.getByRole("button", { name: "Compare evaluations" }).click();
  await expect(page.getByRole("alert")).toContainText("Ground truth differs");
  expect(submitted).toEqual({
    name: "Candidate vs baseline",
    baseline_evaluation_id: "evaluation_base",
    candidate_evaluation_ids: ["evaluation_candidate"],
    metric: "frr",
    coverage_policy: "intersection",
    threshold_policy: "per_evaluation",
  });
});

test("job details poll logs and disable cancellation after the job ends", async ({
  page,
}) => {
  let cancelled = false;
  let deleted = false;
  const job = () => ({
    id: "job_one",
    kind: "training",
    name: "RGB baseline experiment",
    status: cancelled ? "cancelled" : "running",
    resource_id: "training_one",
    progress: 0.2,
    device: "cpu",
  });
  await page.route("**/api/v1/jobs?**", (route) =>
    route.fulfill({ json: collection(deleted ? [] : [job()]) }),
  );
  await page.route("**/api/v1/jobs/job_one", async (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({ json: job() });
    }
  });
  await page.route("**/api/v1/jobs/job_one/logs?**", (route) =>
    route.fulfill({
      json: { next_cursor: 1, text: "Epoch 1 completed", finished: true },
    }),
  );
  await page.route("**/api/v1/jobs/job_one/cancel", async (route) => {
    expect(route.request().method()).toBe("POST");
    cancelled = true;
    await route.fulfill({ json: job() });
  });
  await openPage(page, "Job monitor");
  await page.getByRole("button", { name: /RGB baseline experiment/ }).click();
  await expect(
    page.getByRole("heading", { name: "RGB baseline experiment" }),
  ).toBeVisible();
  await expect(page.getByLabel("Execution log")).toContainText(
    "Epoch 1 completed",
  );
  await expect(page.getByRole("button", { name: "Delete job" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel job" }).click();
  await expect(page.getByRole("button", { name: "Cancel job" })).toBeDisabled();
  expect(cancelled).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete job" }).click();
  await expect(page.getByText("No jobs to show")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete job" })).toHaveCount(0);
  expect(deleted).toBe(true);
});

test("connection settings authenticate JSON, sample images, and report downloads", async ({
  page,
}) => {
  const imagePath = "/datasets/dataset_one/images/sample_one";
  const authenticated: string[] = [];
  await page.route("**/api/v1/datasets/dataset_one/preview?**", (route) =>
    route.fulfill({
      json: collection([
        {
          sample_id: "sample_one",
          fraud_type: "genuine",
          card_type: "mykadfront",
          image_url: `/api/v1${imagePath}`,
        },
      ]),
    }),
  );
  await page.route(`**/api/v1${imagePath}`, async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer test-token");
    authenticated.push("image");
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await page.route("**/api/v1/evaluations?**", (route) =>
    route.fulfill({
      json: collection([
        {
          id: "evaluation_report",
          name: "Saved evaluation",
          status: "succeeded",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/evaluations/evaluation_report", (route) =>
    route.fulfill({
      json: {
        id: "evaluation_report",
        name: "Saved evaluation",
        status: "succeeded",
        report_artifact_id: "artifact_report",
      },
    }),
  );
  await page.route(
    "**/api/v1/artifacts/artifact_report/download",
    async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer test-token");
      authenticated.push("report");
      await route.fulfill({
        contentType: "application/json",
        body: '{"checked":true}',
      });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("API base URL").fill("http://127.0.0.1:7501/api/v1/");
  await page.getByLabel("Bearer token").fill("test-token");
  const health = page.waitForRequest(
    (request) =>
      request.url() === "http://127.0.0.1:7501/api/v1/health" &&
      request.headers().authorization === "Bearer test-token",
  );
  await page.getByRole("button", { name: "Save connection" }).click();
  await health;
  await page.locator("nav").getByRole("button", { name: "Datasets" }).click();
  await page.getByRole("button", { name: /Validation cards/ }).click();
  await expect(page.getByRole("img", { name: "Dataset sample" })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Dataset sample" })
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(1);
  await page.locator("nav").getByRole("button", { name: "Evaluation" }).click();
  await page
    .getByRole("button", { name: "Saved evaluation", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  expect((await download).suggestedFilename()).toBe("report.json");
  expect(authenticated).toContain("image");
  expect(authenticated).toContain("report");
});

for (const mode of ["image", "directory", "csv", "csv_dir", "batch_config"]) {
  test(`direct inference runs ${mode} without registration`, async ({
    page,
  }) => {
    let submitted: Record<string, unknown> | undefined;
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST")
        writes.push(new URL(request.url()).pathname);
    });
    await page.route("**/api/v1/inference-runs/direct", async (route) => {
      submitted = route.request().postDataJSON();
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      await route.fulfill({
        status: 202,
        json: { resource_id: "inference_direct" },
      });
    });
    await page.route("**/api/v1/inference-runs/inference_direct", (route) =>
      route.fulfill({
        json: {
          name: "Direct test",
          status: "succeeded",
          processed_samples: 1,
          request: { output_name: "results.csv" },
          prediction_artifact_ids: ["artifact_direct"],
        },
      }),
    );
    await page.route("**/api/v1/artifacts/artifact_direct/download", (route) =>
      route.fulfill({
        contentType: "text/csv",
        body: "image_path,prediction\n/data/card.png,genuine\n",
      }),
    );
    await openPage(page, "Inference");
    const form = page.getByRole("form", { name: "Direct inference" });
    await expect(
      form.getByRole("button", { name: "Run inference", exact: true }),
    ).toBeDisabled();
    await form.getByLabel("Checkpoint source").selectOption("path");
    await form
      .getByLabel("Checkpoint file", { exact: true })
      .fill("/models/best.pth");
    await form.getByLabel("Input type").selectOption(mode);
    const inputPath =
      mode === "directory"
        ? "/images/mykadback_affin/tamper"
        : `/inputs/${mode}`;
    await form.getByLabel("Input path on server").fill(inputPath);
    await form.getByLabel("Card type for inference").selectOption("mykadback");
    await form.getByLabel("Crop cards before prediction").check();
    await form.getByText("Result name and advanced options").click();
    await form.getByLabel("Save full results").uncheck();
    await form.getByLabel("Results CSV filename").fill("results.csv");
    await form.getByLabel("Threshold override (optional)").fill("0.6");
    await form.getByLabel("Known label (optional)").selectOption("tamper");
    await expect(form.getByLabel("Inference run name")).toHaveAttribute(
      "placeholder",
      `${inputPath.split("/").pop()} · best · MyKad back`,
    );
    if (mode === "csv")
      await form.getByLabel("Inference run name").fill("October review");
    expect(writes).toEqual([]);
    await form
      .getByRole("button", { name: "Run inference", exact: true })
      .click();
    await expect(page.getByText("Inference queued.")).toBeVisible();
    expect(submitted).toMatchObject({
      name:
        mode === "csv"
          ? "October review"
          : `${inputPath.split("/").pop()} · best · MyKad back`,
      checkpoint_path: "/models/best.pth",
      config_path: null,
      input_type: mode,
      input_path: inputPath,
      card_type: "mykadback",
      crop: true,
      threshold: 0.6,
      default_label: "tamper",
      output_name: "results.csv",
      device: "cpu",
      batch_size: 32,
    });
    expect(writes).toEqual(["/api/v1/inference-runs/direct"]);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download results CSV", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe("results.csv");
  });
}

test("direct inference uses a saved training checkpoint and preserves inputs on errors", async ({
  page,
}) => {
  await page.route("**/studio-api/v1/checkpoints", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "saved_one",
            run_name: "Training A",
            name: "best_auc.pth",
            checkpoint_path: "/training/checkpoints/best_auc.pth",
            config_path: "/training/config.yaml",
          },
        ],
      },
    }),
  );
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/inference-runs/direct", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({
      status: 422,
      json: { detail: "No CSV files found in the selected input" },
    });
  });
  await openPage(page, "Inference");
  const form = page.getByRole("form", { name: "Direct inference" });
  await form
    .getByRole("combobox", { name: /^Saved checkpoint/ })
    .selectOption("saved:saved_one");
  await form.getByLabel("Input type").selectOption("csv_dir");
  await form.getByLabel("Input path on server").fill("/empty");
  await form
    .getByRole("button", { name: "Run inference", exact: true })
    .click();
  await expect(
    form.getByText("No CSV files found in the selected input"),
  ).toBeVisible();
  await expect(form.getByLabel("Input path on server")).toHaveValue("/empty");
  expect(submitted).toMatchObject({
    checkpoint_path: "/training/checkpoints/best_auc.pth",
    config_path: "/training/config.yaml",
  });
});

test("threshold displays config defaults, follows card and model, and only sends explicit overrides", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await page.route("**/api/v1/inference-defaults?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const manual = params.has("checkpoint_path");
    return route.fulfill({
      json: {
        thresholds: {
          mykadfront: manual ? 0 : 0.25,
          mykadback: manual ? 0.7 : 0.55,
        },
      },
    });
  });
  await page.route("**/api/v1/inference-runs/direct", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({
      status: 202,
      json: { resource_id: "inference_defaults" },
    });
  });
  await openPage(page, "Inference");
  const form = page.getByRole("form", { name: "Direct inference" });
  await form
    .getByRole("combobox", { name: /^Saved checkpoint/ })
    .selectOption("model:model_one");
  await form.getByText("Result name and advanced options").click();
  const threshold = form.getByLabel("Threshold override (optional)");
  await expect(threshold).toHaveValue("0.25");
  await form.getByLabel("Card type for inference").selectOption("mykadback");
  await expect(threshold).toHaveValue("0.55");
  expect(writes).toEqual([]);
  await form.getByLabel("Input path on server").fill("/images");
  await form
    .getByRole("button", { name: "Run inference", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ threshold: null });
  await page.getByRole("button", { name: "Back to inference runs" }).click();
  await threshold.fill("0.65");
  await form
    .getByRole("button", { name: "Run inference", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({ threshold: 0.65 });
  await page.getByRole("button", { name: "Back to inference runs" }).click();
  await form.getByRole("button", { name: "Use configured default" }).click();
  await expect(threshold).toHaveValue("0.55");
  await threshold.fill("0.9");
  await form.getByLabel("Checkpoint source").selectOption("path");
  await form
    .getByLabel("Checkpoint file", { exact: true })
    .fill("/models/manual.pth");
  await expect(threshold).toHaveValue("0.7");
  await form.getByLabel("Card type for inference").selectOption("mykadfront");
  await expect(threshold).toHaveValue("0");
});

test("inference summary shows whole-run genuine and tampered counts across result pages", async ({
  page,
}) => {
  await page.route("**/api/v1/inference-runs?**", (route) =>
    route.fulfill({
      json: collection([
        {
          id: "inference_summary",
          name: "Folder predictions",
          status: "succeeded",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/inference-runs/direct", (route) =>
    route.fulfill({ status: 202, json: { resource_id: "inference_summary" } }),
  );
  await page.route("**/api/v1/inference-runs/inference_summary", (route) =>
    route.fulfill({
      json: {
        name: "Folder predictions",
        status: "succeeded",
        processed_samples: 40,
        failed_samples: 0,
      },
    }),
  );
  await page.route(
    "**/api/v1/inference-runs/inference_summary/predictions?**",
    (route) => {
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      return route.fulfill({
        json: {
          items: Array.from({ length: Math.min(25, 40 - offset) }, (_, i) => ({
            sample_id: `sample_${offset + i}`,
            prediction: offset + i === 0 ? "genuine" : "tampered",
          })),
          total: 40,
          offset,
          limit: 25,
          summary: { genuine: 1, tampered: 39, total: 40, failed: 0 },
        },
      });
    },
  );
  await openPage(page, "Inference");
  const form = page.getByRole("form", { name: "Direct inference" });
  await form
    .getByRole("combobox", { name: /^Saved checkpoint/ })
    .selectOption("model:model_one");
  await form.getByLabel("Input path on server").fill("/images/tamper");
  await form
    .getByRole("button", { name: "Run inference", exact: true })
    .click();
  const summary = page.getByRole("region", { name: "Prediction summary" });
  await expect(summary).toHaveText(
    "Summary: 1 genuine, 39 tampered (40 total)",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("sample_25", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inference runs", exact: true }),
  ).toBeHidden();
  await expect(form).toBeHidden();
  await page.getByRole("button", { name: "Back to inference runs" }).click();
  await expect(
    page.getByRole("heading", { name: "Inference runs", exact: true }),
  ).toBeVisible();
  await expect(summary).toHaveCount(0);
  await expect(form.getByLabel("Input path on server")).toHaveValue(
    "/images/tamper",
  );
  await page.getByRole("button", { name: /Folder predictions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Inference runs", exact: true }),
  ).toBeHidden();
  await expect(form).toBeHidden();
  await expect(summary).toHaveText(
    "Summary: 1 genuine, 39 tampered (40 total)",
  );
});

test("generated model names follow checkpoint changes while custom names remain editable", async ({
  page,
}) => {
  const checkpoints = [
    {
      id: "epoch36",
      run_id: "august",
      run_name: "August run",
      run_kind: "training",
      name: "epoch_36.pth",
      checkpoint_path: "/august/epoch_36.pth",
      config_path: "/august/config.yaml",
    },
    {
      id: "epoch48",
      run_id: "september",
      run_name: "September run",
      run_kind: "training",
      name: "epoch_48.pth",
      checkpoint_path: "/september/epoch_48.pth",
      config_path: "/september/config.yaml",
    },
    {
      id: "best",
      run_id: "september",
      run_name: "September run",
      run_kind: "training",
      name: "best_auc.pth",
      checkpoint_path: "/september/best_auc.pth",
      config_path: "/september/config.yaml",
    },
  ];
  await page.route("**/studio-api/v1/checkpoints", (route) =>
    route.fulfill({ json: { items: checkpoints } }),
  );
  await openPage(page, "Models");
  await page.getByText("Register a model checkpoint", { exact: false }).click();
  const form = page
    .locator("details.disclosure")
    .filter({ hasText: "Register a model checkpoint" });
  await form.getByLabel("Saved training run").selectOption("august");
  await form
    .getByRole("combobox", { name: "Checkpoint", exact: true })
    .selectOption("/august/epoch_36.pth");
  await expect(form.getByLabel("Model name", { exact: true })).toHaveValue(
    "August run · epoch_36.pth",
  );
  await form.getByLabel("Saved training run").selectOption("september");
  await form
    .getByRole("combobox", { name: "Checkpoint", exact: true })
    .selectOption("/september/epoch_48.pth");
  await expect(form.getByLabel("Model name", { exact: true })).toHaveValue(
    "September run · epoch_48.pth",
  );
  await expect(form.getByLabel("Checkpoint path", { exact: true })).toHaveValue(
    "/september/epoch_48.pth",
  );
  await form
    .getByLabel("Model name", { exact: true })
    .fill("Deployment candidate");
  await form
    .getByRole("combobox", { name: "Checkpoint", exact: true })
    .selectOption("/september/best_auc.pth");
  await expect(form.getByLabel("Model name", { exact: true })).toHaveValue(
    "Deployment candidate",
  );
});

test("inference exposes actual checkpoint path even when registered label names another file", async ({
  page,
}) => {
  await page.route("**/api/v1/models?**", (route) =>
    route.fulfill({
      json: collection([
        {
          id: "model_wrong_label",
          name: "August · epoch_36.pth",
          checkpoint_path: "/september/epoch_48.pth",
        },
      ]),
    }),
  );
  await openPage(page, "Inference");
  const form = page.getByRole("form", { name: "Direct inference" });
  await form
    .getByRole("combobox", { name: /^Saved checkpoint/ })
    .selectOption("model:model_wrong_label");
  await expect(
    form.getByText("Checkpoint file: /september/epoch_48.pth"),
  ).toBeVisible();
});

const fullReport = {
  directory: "/results/review_20260928_120000",
  status: "succeeded",
  full_results: true,
  summary: { genuine: 2, tampered: 69, total: 71, failed: 0, unlabeled: 0 },
  metrics: {
    num_samples: 71,
    accuracy: 69 / 71,
    precision: 1,
    recall: 69 / 71,
    f1_score: 138 / 140,
    auc_roc: null,
    far: 2 / 71,
    frr: null,
    tp: 69,
    tn: 0,
    fp: 0,
    fn: 2,
  },
  error_counts: { fp: 0, fn: 2, failed: 0 },
  per_csv: [
    {
      csv: "test.csv",
      num_samples: 71,
      accuracy: 69 / 71,
      auc_roc: null,
      fn: 2,
      fp: 0,
    },
  ],
  files: [
    { name: "inference_out.csv", size_bytes: 12000 },
    { name: "inference_out_eval_results.txt", size_bytes: 125 },
  ],
  run_info:
    "model: /models/epoch_36.pth\nthresholds by card_type: {'mykadfront': 0.25}",
  warnings: [],
};

async function mockFullReport(page: Page) {
  await page.route("**/api/v1/inference-report?**", (route) =>
    route.fulfill({ json: fullReport }),
  );
  await page.route("**/api/v1/inference-report/rows?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        items: [
          {
            row_index: 0,
            image_path: "/images/missed.jpg",
            ground_truth: "tamper",
            prediction: "genuine",
            prob_tampered: 0.1,
            threshold: 0.25,
            outcome: "fn",
          },
        ],
        total: params.get("outcome") === "errors" ? 2 : 71,
      },
    });
  });
  await page.route("**/api/v1/inference-report/image?**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLj8AAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route("**/api/v1/inference-report/archive?**", (route) =>
    route.fulfill({ contentType: "application/zip", body: "mock zip" }),
  );
  await page.route("**/api/v1/inference-report/file?**", (route) =>
    route.fulfill({ contentType: "text/plain", body: "Accuracy: 0.9718" }),
  );
}

test("full-result run opens evaluation, error images, CSV summaries, and downloads", async ({
  page,
}) => {
  await mockFullReport(page);
  await page.route("**/api/v1/inference-report/options", (route) =>
    route.fulfill({
      json: { results_root: "/mnt5/dataset/tamper/tamper_hub/results" },
    }),
  );
  let submission: Record<string, unknown> | undefined;
  await page.route("**/api/v1/inference-runs/direct", (route) => {
    submission = route.request().postDataJSON();
    return route.fulfill({
      status: 202,
      json: { resource_id: "inference_full" },
    });
  });
  await page.route("**/api/v1/inference-runs/inference_full", (route) =>
    route.fulfill({
      json: {
        name: "Full result",
        status: "succeeded",
        output_dir: fullReport.directory,
      },
    }),
  );
  await openPage(page, "Inference");
  const form = page.getByRole("form", { name: "Direct inference" });
  await expect(form.getByLabel("Save full results")).toBeChecked();
  const location = form.getByLabel("Output location on server");
  await expect(location).toHaveValue("/mnt5/dataset/tamper/tamper_hub/results");
  await location.fill("/mnt5/custom/reports");
  await form.getByRole("button", { name: "Use default location" }).click();
  await expect(location).toHaveValue("/mnt5/dataset/tamper/tamper_hub/results");
  await location.fill("/mnt5/custom/reports");
  await form
    .getByRole("combobox", { name: /^Saved checkpoint/ })
    .selectOption("model:model_one");
  await form.getByLabel("Input path on server").fill("/test.csv");
  await form.getByLabel("Input type").selectOption("csv");
  await form.getByLabel("Output folder name").fill("review");
  await form
    .getByRole("button", { name: "Run inference", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Full inference report" }),
  ).toBeVisible();
  expect(submission).toMatchObject({
    save_full_results: true,
    output_prefix: "review",
    output_root: "/mnt5/custom/reports",
  });
  await expect(
    page.getByText("Summary: 2 genuine, 69 tampered (71 total)"),
  ).toBeVisible();
  const report = page.getByRole("region", { name: "Full inference report" });
  await report.getByRole("tab", { name: "Evaluation", exact: true }).click();
  await expect(
    report.getByRole("heading", { name: "Confusion matrix" }),
  ).toBeVisible();
  await expect(report.getByText("N/A", { exact: true }).first()).toBeVisible();
  await report.getByRole("tab", { name: /Error cases/ }).click();
  await report
    .getByRole("button", { name: /Missed tampering.*missed.jpg/ })
    .click();
  await expect(
    report.getByRole("region", { name: "Image details" }),
  ).toContainText("Applied threshold: 25.00%");
  await report.getByRole("tab", { name: "Per-CSV results" }).click();
  await expect(
    report.getByRole("cell", { name: "test.csv", exact: true }),
  ).toBeVisible();
  await report.getByRole("tab", { name: "Files & run details" }).click();
  await expect(report.getByText(/model: \/models\/epoch_36.pth/)).toBeVisible();
  const file = page.waitForEvent("download");
  await report
    .getByRole("button", {
      name: "Download inference_out_eval_results.txt",
      exact: true,
    })
    .click();
  expect((await file).suggestedFilename()).toBe(
    "inference_out_eval_results.txt",
  );
  const archive = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "Download all results (.zip)" })
    .click();
  expect((await archive).suggestedFilename()).toBe(
    "review_20260928_120000.zip",
  );
});

test("saved CLI inference opens the same full report without submitting jobs", async ({
  page,
}) => {
  await mockFullReport(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  const run = {
    id: "legacy_output",
    name: "CLI results",
    kind: "inference",
    directory: fullReport.directory,
    status: "succeeded",
    modified: "2026-09-28",
    error: "",
  };
  await page.route("**/studio-api/v1/runs", (route) =>
    route.fulfill({ json: { items: [run], roots: [], warnings: [] } }),
  );
  await page.route("**/studio-api/v1/runs/legacy_output", (route) =>
    route.fulfill({
      json: { run, artifacts: [], metrics: {}, history: [], warnings: [] },
    }),
  );
  await openPage(page, "Saved results");
  await page.getByRole("button", { name: "CLI results" }).click();
  await expect(
    page.getByRole("region", { name: "Full inference report" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Evaluation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Confusion matrix" }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("saved results opens a custom output location from the API", async ({
  page,
}) => {
  await mockFullReport(page);
  await page.route("**/studio-api/v1/runs", (route) =>
    route.fulfill({ json: { items: [], roots: [], warnings: [] } }),
  );
  await page.route("**/api/v1/inference-report/saved", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "hub:custom",
            inference_id: "custom",
            name: "Custom folder report",
            kind: "inference",
            directory: "/mnt5/custom/reports/review_20260928",
            status: "succeeded",
            modified: "2026-09-28",
            error: "",
          },
        ],
        roots: [],
        warnings: [],
      },
    }),
  );
  await openPage(page, "Saved results");
  await page.getByRole("button", { name: "Custom folder report" }).click();
  await expect(
    page.getByRole("region", { name: "Full inference report" }),
  ).toBeVisible();
  await expect(
    page.getByText("Summary: 2 genuine, 69 tampered (71 total)"),
  ).toBeVisible();
});

test("inference list describes inputs, checkpoints and available result counts", async ({
  page,
}) => {
  const request = {
    input_type: "directory",
    input_path: "/images/affin_tamper/",
    checkpoint_path: "/models/August/epoch_36.pth",
    card_type: "mykadfront",
    crop: true,
  };
  await page.route("**/api/v1/inference-runs?**", (route) =>
    route.fulfill({
      json: collection([
        {
          id: "inference_old",
          name: "Image folder inference",
          request,
          processed_samples: 120,
          total_samples: 120,
          failed_samples: 0,
          status: "succeeded",
        },
        {
          id: "inference_custom",
          name: "October review",
          request,
          processed_samples: 120,
          total_samples: 120,
          genuine_samples: 15,
          tampered_samples: 103,
          failed_samples: 2,
          status: "succeeded",
        },
      ]),
    }),
  );
  await openPage(page, "Inference");
  const old = page
    .getByRole("row")
    .filter({ hasText: "affin_tamper · epoch_36 · MyKad front" });
  await expect(old).toContainText(
    "Image folder · MyKad front · Cropping enabled",
  );
  await expect(old).toContainText("/images/affin_tamper/");
  await expect(old).toContainText("/models/August/epoch_36.pth");
  await expect(old).toContainText("120 processed / 120 total");
  await expect(old).toContainText("— genuine · — tampered");
  const custom = page.getByRole("row").filter({ hasText: "October review" });
  await expect(custom).toContainText("15 genuine · 103 tampered");
  await expect(custom).toContainText("2 failures");
});

test("saved training runs show dataset distribution and switch runs without stale counts", async ({
  page,
}) => {
  const runs = ["first", "legacy"].map((id) => ({
    id,
    name: `${id} training`,
    kind: id === "legacy" ? "training-legacy" : "training",
    status: "completed",
    directory: `/saved/${id}`,
    modified: "2026-10-08",
    error: "",
  }));
  await page.route("**/studio-api/v1/runs", (route) =>
    route.fulfill({ json: { items: runs, roots: [], warnings: [] } }),
  );
  await page.route("**/studio-api/v1/runs/*", (route) =>
    route.fulfill({
      json: {
        run: runs.find((run) => route.request().url().endsWith(run.id)),
        history: [],
        artifacts: [],
        metrics: {},
        warnings: [],
      },
    }),
  );
  await page.route("**/studio-api/v1/runs/*/distribution", (route) =>
    route.fulfill({
      json: route.request().url().includes("/first/")
        ? {
            total: 10,
            unique_images: 10,
            cross_split_images: 0,
            duplicate_rows: 0,
            splits: [
              { split: "Train", samples: 8, genuine: 6, tamper: 2 },
              { split: "Validation", samples: 2, genuine: 1, tamper: 1 },
            ],
            counts: {
              fraud_type: [{ split: "Train", value: "genuine", samples: 6 }],
              camera: [{ split: "Train", value: "phone", samples: 8 }],
            },
            sources: [],
            warnings: [],
          }
        : {
            total: 0,
            unique_images: 0,
            cross_split_images: 0,
            duplicate_rows: 0,
            splits: [],
            counts: {},
            sources: [],
            warnings: [],
          },
    }),
  );
  await page.route("**/studio-api/v1/runs/*/epochs", (route) =>
    route.fulfill({ json: { items: [], warnings: [] } }),
  );
  await openPage(page, "Saved results");
  await page.getByRole("button", { name: /first training/ }).click();
  await page.getByRole("tab", { name: "Dataset distribution" }).click();
  await expect(
    page.getByText("10 dataset rows", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Distribution field").selectOption("camera");
  await expect(
    page.getByRole("cell", { name: "phone", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Results", exact: true }).click();
  await expect(page.getByText("No result files yet")).toBeVisible();
  await page.getByRole("button", { name: /legacy training/ }).click();
  await page.getByRole("tab", { name: "Dataset distribution" }).click();
  await expect(
    page.getByText("Exact split manifests are unavailable"),
  ).toBeVisible();
  await expect(page.getByText("10 dataset rows", { exact: true })).toHaveCount(
    0,
  );
});
