# Development guide

Tamper Hub uses a feature-oriented React/TypeScript structure. Pages compose
features; feature components own their forms and result views; shared UI stays
independent of specific workflows.

```text
src/
├── app/                  App composition, navigation, shared app types
├── api/                  HTTP client, endpoint paths, connection, API types
├── pages/                One file per dashboard page
├── features/
│   ├── comparison/components/
│   ├── datasets/components/
│   ├── evaluation/components/
│   ├── inference/components/
│   ├── jobs/components/
│   ├── overview/components/
│   └── training/components/
├── components/
│   ├── layout/           Top navigation, header, page heading, application layout
│   ├── ui/               Buttons, cards, fields, notices, status, empty states
│   ├── forms/            Dataset/model picker and compute device selection
│   └── data-display/     Tables, charts, metrics, authenticated sample images
├── hooks/                Remote polling, job logs, shared workspace state
├── utils/                Formatting and job state helpers
├── styles/global.css     Shared tokens, layout, and component styles
└── main.tsx              React entry point
server/                   Read-only local Studio discovery and streaming CSV reader
tests/                    Playwright browser tests with mocked APIs
```

## Finding and changing code

| Change                                  | Location                                            |
| --------------------------------------- | --------------------------------------------------- |
| Page navigation and titles              | `src/app/navigation.ts`, `src/app/App.tsx`          |
| Training form and preflight             | `src/features/training/components/TrainingForm.tsx` |
| Batch and image inference               | `src/features/inference/components/`                |
| Threshold tuning and evaluation         | `src/features/evaluation/components/`               |
| Backend route paths                     | `src/api/endpoints.ts`                              |
| JSON and multipart requests             | `src/api/client.ts`                                 |
| Base URL, token, and connection storage | `src/api/config.ts`                                 |
| Downloading reports                     | `src/api/artifacts.ts`                              |
| Polling resource data or logs           | `src/hooks/useRemote.ts`, `src/hooks/useJobLogs.ts` |

For example, `TrainingPage` composes `TrainingForm`, `TrainingImportForm`, the
saved run list, and `TrainingRunDetails`. The form submits through
`submit(endpoints.training.create, body)` and returns the created resource ID
through `onCreated`. The page selects that ID, and the details component polls
its metrics and checkpoints.

The default request flow is:

```text
Feature component → api/client.ts → /api/v1/...
                  → Vite /api proxy → backend api/main.py on port 7501
```

The proxy target remains configurable through `TAMPER_API_URL`. Settings can
also select an absolute API base URL. The production web server must provide
the proxy or the backend must allow the configured frontend origin.

## Direct inference

`DirectInferenceForm` is the primary inference workflow. It accepts a saved
checkpoint or checkpoint/config paths, and an image, image folder, CSV, CSV
folder, or batch YAML. It submits only on user action to
`POST /api/v1/inference-runs/direct`. The companion backend changes in
`api/direct_inference.py` are required; restart the API after updating it.

The threshold field reads `GET /api/v1/inference-defaults` for the selected
checkpoint/config and shows the chosen card's effective default. This read does
not register or submit anything. Untouched values submit `threshold: null`, so
mixed-card CSVs retain per-card thresholds; only an edited value overrides them.

Direct jobs snapshot their input manifest and model config under the API
workspace's `submissions/` directory without adding dataset or model registry
entries. They use the existing inference worker, job polling, cancellation,
crop configuration, and artifact downloads. Images and folders are server paths;
CSV image paths resolve relative to the CSV folder. Batch YAML uses `csv_files`
and optional `base_dir`, with relative base directories resolved from the backend
project root. Missing batch CSVs fail validation before queuing.

Predictions always save in `runs/<inference_id>/<output_name>` (default
`inference_out.csv`). “Results CSV filename” controls the actual downloadable
filename, unlike the CLI's `--output` folder-prefix convention. Optional labels
are retained for the existing evaluation workflow. The previous registered
dataset and image-upload workflows remain in a collapsible section.

“Save full results” is enabled by default for direct inference. The worker then
exports `<workspace>/results/<output_prefix>_<timestamp>/` (default workspace
`/mnt5/dataset/tamper/tamper_hub`, prefix `results`). The Output location on server
field accepts a custom absolute parent folder, validated against allowed roots;
missing folders are created by the worker. This contains `inference_out.csv`, `run_info.txt`, a config
snapshot, and `report.json`. Labeled runs also export
`inference_out_eval_results.txt` and `error_cases/` with FP/FN image copies and a
CSV index. CSV inputs additionally get `per_csv_summary.csv`. Metrics use the
saved prediction decisions; undefined rates/AUC are N/A. Unlabeled/failed rows
are excluded from evaluation but remain in predictions. Name collisions receive
a numeric suffix; image copies include a path hash to avoid basename collisions.

The report tabs use authenticated read-only `/inference-report` endpoints for
metadata, paginated rows, image previews, individual files, and ZIP downloads.
They accept an inference run ID or a saved folder path validated by backend
allowed roots. File downloads reject traversal and symlink escapes. ZIPs are
temporary files removed after the response. The same `InferenceReport`
component serves new runs and existing CLI folders in Saved results; legacy
metrics and error labels are read from their sidecar files. No model execution
or evaluation jobs are submitted by opening a report.

Exporting remains part of the inference job. A `.incomplete` marker prevents
unfinished/cancelled exports from appearing in Saved results or being presented
as completed reports. Copy failures are recorded as report warnings. Backend
`Settings.results_root` can override the export root; Saved results discovery
defaults to `<TAMPER_API_WORKSPACE>/results` and also scans the legacy project
results folder. `TAMPER_STUDIO_RESULTS` overrides the scan root. The authenticated
`/inference-report/saved` index adds completed Hub reports, including custom
locations, to Saved results without registration. Restart the API after
updating these backend modules; workers launch fresh task processes per job.

## Saved Studio data

`server/studio.ts` follows the file contracts in the reference repository's
`training_studio/run_sources.py`, `artifacts.py`, `inference_page.py`, and
`evaluation_artifacts_page.py`. It scans immediate checkpoint run directories,
merges Studio registry metadata by canonical artifact path, and discovers
`inference_out.csv` under Studio outputs and the legacy `results/` tree (up to
8 directory levels). Stable opaque IDs identify discovered runs; requests do not
accept arbitrary filesystem paths. Canonical path checks reject symlink escapes.

`server/csv.ts` streams CSV/gzip data, including quoted multiline fields, keeps
identifiers as text, converts known numeric metrics, and leaves unavailable
numbers null. Prediction browsing filters the entire artifact and retains only
the requested page in memory. Outcome filters accept both `tamper` and `tampered`
labels and use saved inference-job default labels when present. Metadata JSON is
expanded into prefixed columns. Failed and unlabeled rows remain visible.

`server/middleware.ts` exposes only GET routes under `/studio-api/v1/runs`:
collection discovery, `/{id}` details, `/{id}/table?artifact=…` with pagination
and filters, and `/{id}/download?artifact=…` for original CSV/gzip downloads.
Summaries derived from history or old text reports have no standalone download.
Tables read files again on refresh, so ongoing runs can acquire new artifacts.
Malformed files produce visible errors instead of silently returning no data.

Vite mounts the reader for dev and preview. `server/start.ts` provides the same
reader for a production reverse proxy; it listens on loopback only. Configuration
is server-side environment variables, documented in the README. There is no
Python/model dependency or connection to the operations job queue.

`SavedResultsPage` owns run selection. Its feature components own split/artifact
selection and table filters. Every request and download uses `api/client.ts`;
only `/studio-api/` paths bypass the operations base URL from Settings. Bearer
headers still apply. `useRemote` cancels requests and timers on unmount. The
reader refreshes independently of the operations API and never imports runs into
its registry automatically.

Run `npm run test:results` for isolated filesystem and HTTP regressions covering
legacy fallbacks, separate splits, gzip/CSV quoting, filtering/pagination, null
metrics, read-only methods, and path confinement. Fixtures live in temporary
folders; real result files and the operations backend remain unchanged.

The operations API defaults to `/mnt5/dataset/tamper/tamper_hub` for persistent
state. Its registry, dataset manifests, model metadata, frozen submissions,
imports, uploads, locks, and run outputs have separate subdirectories. API and
worker processes must use the same `TAMPER_API_WORKSPACE` value when overridden.

## Liveness Hub design and workflow arrangement

The interface follows the reference pages in
`../liveness_hub/api/static/`: the gradient home portal and feature cards from
`index.html`, numbered setup from `training.html`, and light configuration/results
panels from `inference.html` and `summary.html`. Shared tokens and responsive
layouts live in `src/styles/global.css`; no external UI package is required.

- Home groups Training, Inference, Summary & evaluation, Job monitor, Model
  registry, and Data management into six cards. The top navigation keeps each
  operation directly accessible.
- Training follows Compute → Datasets → Configuration → Review. Back navigation
  preserves inputs. Missing training data or empty configuration prevents advancing;
  the configuration step loads the full selected YAML template and edits a
  private per-run copy. Dataset and region paths remain controlled by registered
  inputs. Preflight and submission use the same YAML snapshot. Only the final
  Start training action queues a run. Run history and progress sit beside setup.
- Inference places batch setup beside single-image inspection and run history.
  Both forms still share device and crop settings. Single-image inspection lists
  registered models and checkpoints discovered from saved training runs, and
  accepts one or many browser uploads, an absolute backend-visible image path,
  or a saved server path persisted in the operations registry.
  Selecting an unregistered saved checkpoint registers its frozen metadata before
  prediction. Registration remains accessible in inference and also has a
  dedicated Model registry workspace.
- Saved Studio results, Evaluation & thresholds, and Model comparison share a
  results navigation strip. Saved-run selection sits beside its results;
  evaluation and comparison put configuration beside history and output.
- Data management scans the configured training and testing roots, groups source
  CSVs by role/card type/label, and saves selected sources as immutable dataset
  snapshots. Saved training collections only appear in the training/validation
  pickers; saved testing collections appear in the test picker. The library and
  sample preview remain beside the source browser.
  Job monitoring places the job list beside the selected job's logs and controls.
- Columns stack on smaller screens. Navigation remains visible on mobile.
  Buttons expose current navigation/step state, and a skip link reaches content.

Existing Playwright regressions cover the home card, all navigation destinations,
training step validation/back navigation, and registry-to-inference selection.
Browser checks continue to mock backend submissions.

## Component and state conventions

- One exported React component per file, named to match its PascalCase filename.
  Use named exports and `@/` imports; the alias is configured for Vite and TypeScript.
- Pages coordinate selection and compose feature components. Move form fields,
  result rendering, and their private state into the relevant feature folder.
- Keep state as close to its owner as possible. Inference lifts device, crop,
  and model selection to the page because multiple forms share them.
  Evaluation keeps its thresholds with the form; sweep results apply changes
  through callbacks.
- Reuse `components/` across features. Keep domain-specific UI under `features/`.
  Import shared types without importing a page or the application implementation.
- Add endpoint names to `api/endpoints.ts`; use `api`, `submit`, or `fetchBlob`
  from the HTTP client. `submit` sets JSON encoding and job idempotency headers.
  File uploads use `FormData` so the browser supplies its multipart boundary.
- Clear polling timers and ignore responses after unmount. Navigation and
  rendering are read-only; mutations require an explicit user action.
- The existing API `Row` type permits heterogeneous model metrics and artifact
  metadata. Add narrower resource and request types as individual API contracts
  evolve; do not spread new untyped state throughout the UI.

Repository-level instructions for future coding work are in `AGENTS.md`.

## Checks

```bash
npm run format         # Apply the shared Prettier configuration
npm run check          # Strict TypeScript plus formatting verification
npm run build          # Compile and build the standalone frontend
npm test               # Browser navigation and workflow regressions
```

Install the browser once with `npx playwright install chromium`. If using an
existing custom browser cache, set `PLAYWRIGHT_BROWSERS_PATH` consistently for
installation and testing. On the current development host it is
`/tmp/tamper-playwright-browsers`.

Browser tests intercept API requests. They verify navigation, request payloads,
error presentation, mobile layout, model registration, shared inference settings,
threshold application, comparison policies, job cancellation, and authenticated
image/report downloads without creating
real backend jobs.

## Optional development skills

The project already includes TypeScript, Prettier, and Playwright. No additional
plugin is required to run or develop it.

- The official [Playwright skill](https://github.com/openai/skills/tree/main/skills/.curated/playwright)
  is useful for interactive browser navigation, screenshots, and debugging UI
  flows during coding. The npm Playwright test runner is already installed;
  this optional skill adds an agent workflow, not an application dependency.
- If designs later come from Figma, consider the official
  [Figma design implementation skill](https://github.com/openai/skills/tree/main/skills/.curated/figma-implement-design).
  It is useful when translating actual Figma designs and requires its Figma
  connection. It is unnecessary for the current code refactor.

The Playwright skill was installed on 2026-09-15 at
`/home/bryanchang/.codex/skills/playwright`. The Figma skill remains optional and
has not been installed.

Training step 3 exposes an editable **Output location on server**, defaulting to
`<TAMPER_API_WORKSPACE>/checkpoints` (normally
`/mnt5/dataset/tamper/tamper_hub/checkpoints`). Validation and submission use the
same `output_root`, validated against backend allowed roots. The worker reserves
an `experiment_name_<YYYYMMDD_HHMMSS>` folder (with a numeric suffix on collision)
and passes its exact path to the trainer's `--output-dir`. Config, checkpoints,
reports, and TensorBoard logs stay with that run. Tracking reads only that
reserved folder so concurrent runs cannot pick up each other's files. Existing
queued payloads without `output_root` retain their original job-local output.
The local Saved results reader also scans the Hub checkpoints folder; custom
locations remain accessible through the training run's recorded artifact path.

### Saved training diagnostics

Saved results includes Dataset distribution and Epoch details tabs. The local
reader exposes read-only `/studio-api/v1/runs/:id/distribution`, `/epochs`, and
`/performance?artifact=:artifactId` endpoints through the shared HTTP client.
Epochs combine training history, split-specific checkpoint summaries (or legacy
text reports), per-CSV summaries, and prediction artifact references. Checkpoint
and split remain separate keys; history is matched by epoch number. Saved
summary metrics take precedence over validation-history fallback metrics.

Per-card performance streams the entire selected prediction artifact, independently
of table pagination. It uses saved decisions (or saved probabilities and thresholds
when decisions are absent), with tamper as the positive class. FAR is FN/(TP+FN)
and FRR is FP/(TN+FP). Missing labels or decisions are excluded and counted;
undefined denominators return null. ROC AUC uses tie-aware ranks and is available
only when all evaluated rows have tamper probabilities and both classes exist.
Legacy confidence is never interpreted as a tamper probability. Explicitly
mismatched checkpoint/split rows are excluded with a warning. No diagnostics
request submits jobs or reruns evaluation.

Job history supports deleting terminal jobs and their generated files from the
job details panel after confirmation. The API rejects active jobs and outputs
referenced by another job or registered model. Deletion removes the owned run,
submission, checkpoint/report, and managed-upload files. Shared datasets and
source images are preserved. Success clears selection and refreshes the list.

The job monitor displays experiment/run names as the primary row label and
selected-job heading, with job type and ID as secondary information.

Model Comparison starts with a saved run/checkpoint comparison. It uses the
existing saved-results checkpoint catalog and epoch metrics endpoints, supports
validation or test results, and displays candidates beside a selected baseline
with percentage-point deltas. Changing the split clears selections; checkpoints
without saved metrics cannot be added. This view does not submit jobs or claim
matching dataset coverage/thresholds. The existing evaluation comparison remains
available below for coverage and threshold compatibility checks.

## Grad-CAM workspace

The sidebar places Grad-CAM immediately after Inference. `GradcamPage` composes
`features/gradcam/components/GradcamForm` and `GradcamResults`. The form loads
the existing saved-checkpoint catalog, supports registered models, and submits
only on an explicit button click. Uploads use the shared multipart client and
idempotency headers. The result gallery polls the Python API, renders twelve
composites per page, downloads authenticated artifacts, and links to Job Monitor.
No inference or training work is triggered by navigating to this page.

Inference and saved-result image actions pass image/card/checkpoint context to
the page. Legacy results without an identifiable checkpoint require a selection.
The existing CLI's uncropped input preprocessing is used; heatmaps show class
attribution rather than a tamper mask. Grad-CAM++ is not included.

Backend endpoints are centralized under `endpoints.gradcam`; the Python backend
must be restarted after installing the new routes. Run `npm run check`,
`npm run build`, and `npx playwright test tests/gradcam.spec.ts` to validate the
UI with mocked job submissions.

## Inference uploads

`DirectInferenceForm` now switches between server paths, local image selection,
and local folder selection. `InferenceUploadInput` owns file-picker validation
and selection feedback; folders use `webkitdirectory` and retain relative
paths. Non-image files are excluded with a visible count. Limits are 1,000
images, 20 MB/image and 500 MB combined.

Only clicking Run inference uploads files. The shared API client sends multipart
`request` JSON and repeated `files` entries to `endpoints.inference.upload`,
with an idempotency header. Existing model, device, crop, threshold, and output
options apply. A failed request preserves the selected files for retry; changing
the input source clears them. Server-path behavior remains available.
`tests/inference-upload.spec.ts` mocks submissions and exercises single-image,
nested-folder, and error flows.

### Grad-CAM layout alignment

Grad-CAM follows the Inference page's numbered checkpoint/input/run sections,
shared compute selector and busy button, and collapsed advanced options.
Checkpoint source has exactly two choices: a saved checkpoint or an explicit
path. The saved dropdown groups Models first, then Training checkpoints, matching
Inference. Input source separates server paths and single-image upload.
The main page shows a run table with status, counts, and the shared deletion
action. Selecting or creating a run opens details with a back button; the form
stays mounted but hidden so returning preserves its selections. Navigation does
not submit work. Output location on server and Output folder name mirror
Inference, with a default-location reset and a timestamped-folder preview.
The backend creates a dedicated output folder and records it for job deletion.

Grad-CAM's Input source also includes **Upload image folder**, reusing
`InferenceUploadInput` and the backend's shared upload transport through
`endpoints.gradcam.uploads`. Folder selection preserves subfolders and skips
non-image files. The Grad-CAM image limit continues to apply; changing sources
clears selected files. Existing single-image uploads keep their endpoint.
