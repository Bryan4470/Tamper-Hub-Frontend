# Tamper Hub

Standalone React/TypeScript dashboard for the operations API in
`/home/bryanchang/face-tamper-multiclass/api`.

## Run

Use Node.js 22.12 or newer (tested with 22.22).

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to
**http://127.0.0.1:7501**.

To access the frontend from another computer on the local network, stop any
running dev server and restart it listening on all network interfaces:

```bash
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Open **http://10.1.1.177:5173/** from the other computer. `10.1.1.177` is this
server's current LAN address; if it changes, use the Network URL printed by Vite.
The server firewall must allow incoming connections on port `5173`. The backend
can stay on `127.0.0.1:7501` because Vite proxies API requests on the server.

To use a different backend:

```bash
TAMPER_API_URL=http://127.0.0.1:8500 npm run dev
```

Start the backend and a CPU worker from the model repository in separate terminals:

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 7501
python -m api.worker --device cpu
```

Set `TAMPER_API_DATA_ROOTS` identically for the backend and workers before
registering external mounted paths. Add a GPU worker with
`python -m api.worker --device GPU-YOUR-UUID` when needed. Full backend setup and
endpoint documentation are in `face-tamper-multiclass/api/README.md`.

For a direct cross-origin backend connection, enter its full `/api/v1` URL in
Settings and include the frontend origin in backend `TAMPER_API_ORIGINS`.
An optional bearer token is stored in browser session storage; the API URL is
stored in local storage. The browser never invokes model code directly.

## Read existing Training Studio results

Open **Saved results** in the sidebar (or **Browse saved results** on Overview).
Tamper Hub discovers saved training and inference folders automatically, without
registering or rerunning them. Choose a run, then a split and saved artifact to
view loss curves, checkpoint summaries, leaderboards, per-dataset results,
predictions, or threshold sweep rows. Search/filter predictions, move through
pages, and download the original CSV or gzip file.

The local reader is included in `npm run dev` and `npm run preview`; the operations
API provides inference reports and discovers Hub exports in custom locations.
Training result browsing uses Node.js only and never imports the model runtime. By default it reads training runs from
`/mnt5/dataset/tamper/checkpoints`, legacy training runs from the sibling
repository's `checkpoints/`, and inference data from its
`training_studio/workspace/` and `results/` directories, plus
`/mnt5/dataset/tamper/tamper_hub/results` for new Hub exports.
Inference defaults to saving each full report in a `results_<timestamp>` subfolder
there. Set **Output location on server** to choose another parent folder.
Discovered `.pth` and `.pt` files inside each training run's `checkpoints/`
folder are available in the model registration selectors. Choose a training run
first, then one of its checkpoints; the selection also fills the run-level
`config.yaml` path. Training runs are ordered newest to oldest using their
trailing `YYYYMMDD_HHMMSS` timestamp. Checkpoints within the selected run are
ordered newest to oldest using the trailing number in the filename.

Registered models support an optional operational remark. The registry records
their saved date automatically and lets operators edit the model name or remark
or remove a registry entry. Removing an entry never deletes its checkpoint or
training-run files.

Override the locations in the terminal that starts Tamper Hub if needed:

```bash
TAMPER_STUDIO_PROJECT=/home/bryanchang/face-tamper-multiclass npm run dev
```

Optional overrides are `TRAINING_STUDIO_CHECKPOINTS`, `TRAINING_STUDIO_WORKSPACE`
(the same variables used by Studio), `TAMPER_STUDIO_LEGACY_CHECKPOINTS`, and
`TAMPER_STUDIO_RESULTS`. Paths refer to
the server host. Missing folders and unreadable files are shown in the UI.
The connection URL in Settings applies to the operations API; saved results use
the local, same-origin `/studio-api/v1` reader together with the operations API
for inference reports. Browsing does not modify saved files.

Validation summaries fall back to `logs/training_log.csv` for older runs. Test
summaries fall back to saved `*_results.txt` reports. Validation and test data stay
separate; absent metrics display N/A. Predictions preserve the original values,
including legacy `confidence` semantics; use `prob_tampered` as the tamper score.
Existing reports are displayed as saved, not recomputed.

For a production static deployment, run `npm run results:serve` on the host with
the saved files and proxy `/studio-api/` to `http://127.0.0.1:7502`, preserving the
original Host header. Set `TAMPER_STUDIO_PORT` to change that port. The built
`dist/` alone cannot read server files. Keep the reader behind your authenticated
frontend; optionally set `TAMPER_STUDIO_TOKEN` and enter the same bearer token in
Settings. Cross-origin browser requests and all write methods are rejected.

## Available workflows

- **Overview:** datasets, checkpoints, jobs, worker availability and GPU memory.
- **Datasets:** discover CSV manifests from the roots in `config.yaml`, group them
  by training/testing role, card type and label, save immutable collections,
  preview samples, inspect versions and queue image validation.
- **Training:** choose configuration templates, training/validation/test datasets,
  GPU/CPU and edit the complete YAML for a private run snapshot; run preflight,
  launch training, inspect loss curves and register checkpoints. Existing
  training runs can be imported.
- **Inference:** register existing models, launch model × dataset batches, inspect
  images by choosing a model/checkpoint and uploading one or many images, entering
  a backend-visible server path, or reusing a saved path; browse saved
  predictions/errors. Completed single-image jobs render their image, verdict,
  class probabilities, threshold, card type, and job-log link inline.
- **Evaluation:** import older prediction CSVs, evaluate saved probabilities,
  inspect FAR/FRR/AUC/F2, confusion matrices and breakdowns, and tune separate
  front/back thresholds.
- **Comparison:** select baseline/candidate evaluations, require matched coverage
  or rescore their common samples, inspect deltas, and download a report.
- **Job monitor:** status, logs, progress, cancellation and links to results.

## Persistent Hub storage

Tamper Hub stores all generated state under
`/mnt5/dataset/tamper/tamper_hub` by default. The workspace is organized into
`datasets/`, `models/`, `runs/`, `submissions/`, `imports/`, `uploads/`,
`locks/`, and `registry/`. Set `TAMPER_API_WORKSPACE` on both the API and workers
to override this location. Original source images are referenced in place and
are not copied into the Hub workspace.

The operations lists are empty until datasets/models are registered or previous
runs imported. Existing Studio outputs are available independently in Saved results. Navigation never submits work. Training/inference/evaluation run
only after their submission buttons are pressed. No sample scores are presented
as real model results.

## Build and test

```bash
npm run check
npm run build
npm run test:results
npx playwright install chromium
npm test
```

The browser tests exercise all navigation, registration request contracts,
backend-error presentation and mobile layout without launching training.

For production, serve `dist/` with a web server that proxies `/api` to the backend.
The Vite development proxy is not included in the built files. `npm run preview`
can preview static files; configure a direct API URL in Settings when using it.

## Development structure

Each page lives in `src/pages/`. Workflow forms and result panels live in
`src/features/<feature>/components/`; reusable UI lives in `src/components/`.
API calls use `src/api/client.ts` and routes are listed in `src/api/endpoints.ts`.

See [the development guide](docs/development.md) for folder ownership, component
conventions, API flow, checks, and optional development skills. Future coding
conventions are recorded in [AGENTS.md](AGENTS.md).

## Dashboard layout

Tamper Hub follows the design and workflow arrangement of the local Liveness Hub:
a purple gradient home page with feature cards, light workspaces, and a distinct
accent for each workflow. Training uses four setup steps; inference, evaluation,
data management, and job monitoring place configuration or selection beside
results. Saved Studio results, threshold evaluation, and model comparison are
grouped together. The Model registry provides a dedicated checkpoint library.

See [the development guide](docs/development.md#liveness-hub-design-and-workflow-arrangement)
for the component mapping and interaction details.
