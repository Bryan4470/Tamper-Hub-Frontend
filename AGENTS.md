# Tamper Hub development conventions

This is the standalone React and TypeScript frontend. The operations backend
lives in `../face-tamper-multiclass/api`.

- Keep one exported React component per PascalCase `.tsx` file. Place page
  composition in `src/pages/`, workflow-specific forms and result panels in
  `src/features/<feature>/components/`, and reusable UI in `src/components/`.
- `src/app/` owns application composition, navigation metadata, and shared app
  types. Components must not import pages or the `App` implementation.
- Keep HTTP transport in `src/api/client.ts`, endpoint paths in
  `src/api/endpoints.ts`, and connection storage in `src/api/config.ts`.
  Use the shared client for JSON, multipart, image, and artifact requests.
- Put reusable hooks in `src/hooks/` and pure helpers in `src/utils/`. Keep
  feature form state local; lift only values shared by sibling components.
  Pass explicit typed props and callbacks across component boundaries.
- Use named exports and `@/` imports. Use `import type` for type dependencies.
  Do not create barrel files or dependencies solely to shorten imports.
- Keep effects and event handlers responsible for network activity. Rendering
  or opening a page must never submit training, inference, or evaluation jobs.
  Preserve polling cleanup, bearer authentication, multipart encoding, and
  idempotency headers when changing requests.
- Follow Prettier formatting. Run `npm run check`, `npm run build`, and browser
  tests relevant to changed workflows. Existing browser tests mock the backend;
  do not run real training or submit jobs to the user's backend for UI checks.
- Document architecture or startup changes in `docs/development.md` or the
  README. Keep this frontend independently runnable with `npm run dev`.
