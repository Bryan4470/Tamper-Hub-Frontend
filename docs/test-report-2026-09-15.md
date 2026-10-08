# Tamper Hub verification — 2026-09-15

All checks listed below passed. These checks verify software behavior and execution
using synthetic data; they do not measure real-world tamper detection accuracy.
The external crop service was not configured and remains unverified.

## Results

| Area                         | Result    | Coverage                                                                                                                                                                                                                                 |
| ---------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and formatting    | Passed    | Strict type checking and Prettier                                                                                                                                                                                                        |
| Production build             | Passed    | Vite build, including the favicon fix                                                                                                                                                                                                    |
| Browser regression suite     | 9 passed  | Every page, dataset registration and errors, mobile layout, training preflight, model registration, shared inference settings, threshold application, comparisons, cancellation, connection settings, authenticated images and downloads |
| Backend regression suite     | 28 passed | API contracts, validation, frozen data/configs, imports, metrics, thresholds, comparison policies, downloads, persistence, worker locking/cancellation, and related data/training regressions                                            |
| Real CPU model workflow      | Passed    | One epoch on 8 training images, 4 validation images, and 4 test images; checkpoint registration, batch inference, and evaluation                                                                                                         |
| Real GPU inference           | Passed    | GPU 1, NVIDIA GeForce RTX 5090; 4 synthetic test images, 0 failures                                                                                                                                                                      |
| Real GPU training            | Passed    | GPU 1; one epoch using the same tiny synthetic splits, 4 saved checkpoints including last_epoch.pth                                                                                                                                      |
| Single-image API             | Passed    | Valid image upload, CPU execution, probability result, and idempotent retry returning the same prediction                                                                                                                                |
| Training-run import          | Passed    | Imported the synthetic run and discovered its 4 checkpoints                                                                                                                                                                              |
| Live browser/API integration | Passed    | Viewed GPU results, handed predictions to evaluation, submitted evaluation, rendered metrics/ROC/confusion matrix, downloaded a valid 4-sample report, and compared CPU/GPU evaluations under strict matching policies                   |
| Browser console after fix    | Passed    | 0 errors and 0 warnings                                                                                                                                                                                                                  |

The 9 browser regression tests use intercepted API responses. The separate live
browser checks used the installed Playwright CLI skill against a real temporary
API and worker, providing additional coverage of actual frontend/backend contracts.
The live workspace contained 8 successful jobs when verification finished.

## Fix made during testing

The browser reported a 404 for `/favicon.ico`. Added `public/favicon.svg` and an
explicit icon link in `index.html`, then repeated the frontend checks. A fresh
browser session had no errors. No application workflow defects were found by
the checks performed.

## Installed skill

The official Playwright skill is installed at
`/home/bryanchang/.codex/skills/playwright`. Its wrapper is executable and was
used for the live browser checks. It will be discovered automatically on the
next conversation turn. No global npm Playwright CLI installation was needed.

## Reproduce the automated checks

From `/home/bryanchang/tamper_hub`:

```bash
npm run check
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/tamper-playwright-browsers npm test
```

From `/home/bryanchang/face-tamper-multiclass`:

```bash
TAMPER_API_ENGINE_TESTS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 \
  python -m pytest -q api/tests \
  training_studio/tests/test_configuration.py \
  training_studio/tests/test_datasets.py \
  tests/test_source_metadata.py \
  tests/test_prediction_capture.py \
  tests/test_evaluation_artifacts.py
```

## Evidence and limits

Snapshots, screenshots, the downloaded report, GPU results, and backend JUnit
output are in `output/playwright/validation-20260915/`. This generated directory
is ignored by Git and Prettier. `summary.json` records the live check results.

The temporary API listened on localhost port 17501 and the temporary dashboard
on port 15173. Their workspace was generated by the synthetic integration test;
existing experiments were not used. Temporary services and the browser were
stopped after verification.

The external crop service was not tested because no crop URLs were configured.
Production datasets, long-running training, throughput/load, other browser
engines, and deployment/network configurations were not validated by this run.
One non-failing Starlette/httpx deprecation warning appeared in the backend suite.
