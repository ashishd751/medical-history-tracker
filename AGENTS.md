# AGENTS.md

Rules for any AI coding agent or human contributor working in this repository.

## Project

A private, **offline** medical-history tracker for one family. Expo SDK 58 / React Native 0.88,
TypeScript strict, Android + iOS only. No backend, no accounts, no analytics, no notifications,
**no camera**. All data stays on the device.

## Non-negotiables

1. **Never commit real medical data.** `private-samples/` is git-ignored and separately guarded by a
   pre-commit hook. All test fixtures must be synthetic (invented people, values, doctors).
2. **No camera.** `expo-image-picker` is configured with `cameraPermission: false` and
   `microphonePermission: false`, which inject `tools:node="remove"` into the Android manifest.
   Never add a dependency that requires camera access.
3. **No network calls.** Except the opt-in Tier 3 engine (Phase 9, off by default, per-upload consent).
   Never add analytics, crash reporting or telemetry.
4. **No OS notifications.** Warnings and confirmations are in-app banners, sheets and dialogs.
5. **TypeScript strict.** No `any` without a commented justification. No non-null assertions without
   a comment.
6. **This repo commits as `ashishd751@gmail.com`** (repo-local config). Global git identity belongs
   to the user's employer — never change global git config.
7. **Read the docs before using an API.** Installed versions are recent (SDK 58, RN 0.88, Zod 4,
   Paper 5). If memory and docs disagree, the docs win. Use the **new** `expo-file-system` API
   (`File`, `Directory`, `Paths`); `File.write()` is async in SDK 58, use `writeSync()` for the old
   behaviour.

## Architecture rules (enforced by dependency-cruiser in CI)

```
Screens (app/)  ->  features/*  ->  domain (pure TS)  <-  data/
                        |                                  platform/
                        ->  ui/  <-
```

- `src/domain/` imports **nothing** from React, React Native, Expo or other layers. Pure TypeScript.
- `src/data/` imports `src/domain/` only (plus Drizzle / expo-sqlite / expo-file-system).
- `src/platform/` imports `src/domain/` types only; each capability is an interface with one impl.
- `src/ui/` imports nothing from `features/`, `data/`, `platform/`.
- `features/*` must not import each other's internals; share through `domain/` or `lib/`.
- `app/` routes only wire screens to features.

Run `npm run deps:check` after adding imports.

## Conventions

- **Never import `react-native-paper` directly** outside `src/ui/`. Features consume `src/ui`.
- One component per file, PascalCase files for components, camelCase for modules.
- Named exports everywhere; route files are the only default exports (framework requirement).
- User-facing strings live in `src/ui/strings.ts`.
- All database access goes through repositories; every write is transactional.
- **Never run `VACUUM`.** `record_fts` is keyed by `record.rowid`, and a renumbering would silently
  desynchronise the search index. After a bulk write that bypasses triggers (Phase 5 backup import),
  call `rebuildSearchIndex(db)` from `src/data` (ADR-023).
- All file I/O goes through `src/data/fileStore.ts` and returns `Result`.
- Store **relative** attachment paths in SQLite, never absolute URIs.
- Attachment work goes through `src/features/records/attachments/attachmentService.ts`: pick → stage
  in `staging/<draftId>/` → move on save → delete after commit. The startup sweeper reconciles files
  with rows; do not delete files inline anywhere else (ADR-033, ADR-034).
- Dates without time are `YYYY-MM-DD` strings in storage; never round-trip them through UTC. Render
  them for users as **`DD/MM/YYYY`** (use `formatDisplayDate` from `src/lib/dates.ts`). Never show a
  raw ISO date in the UI.
- Measurements are stored in metric; convert only at display time.

## Before every commit

```bash
npm run typecheck && npm run lint && npm test
```

Never claim a check passed without running it. Conventional Commits only (`feat:`, `fix:`, `chore:`,
`test:`, `docs:`, `refactor:`).

## Phase discipline

Work one phase at a time from `docs/PHASES.md`. At the end of a phase, produce a gate report and
**stop**. Do not start the next phase without explicit approval.
