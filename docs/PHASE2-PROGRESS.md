# Phase 2 — Attachments: progress

Working branch: `feat/phase-2-attachments` (from `main` at `afe7bed`).

Rules for this file: one tick per finished task, with one line of **evidence** (the command and its
result, or the file that proves it). A task is not ticked until its gate has run. If a session runs out
of context, the next session resumes from the first unticked box.

Gate for every commit:

```bash
npm run typecheck && npm run lint && npm run deps:check && npm run format:check && npm test
```

## Checklist

- [x] **T0** Branch, this file, baseline gate (expect 27 suites / 162 tests).
- [x] **T1** `src/platform/` ports + Expo implementations + fakes; dependency rule proven.
- [x] **T2** Domain helpers: paths, mime/extension, limits, strings; unit tests.
- [ ] **T3** `src/data/fileStore.ts` over an injected file-system port; tests with the in-memory fake.
- [ ] **T4** `attachmentRepository` + `recordRepository.remove()` returns attachment paths; SQLite tests.
- [ ] **T5** Attachment service (import pipeline, save/removal ordering, compensation); tests with fakes.
- [ ] **T6** Startup sweeper (orphans, staging, rows with missing files); tests.
- [ ] **T7** Record form sections (Prescription / Reports and other files) + draft integration.
- [ ] **T8** Record detail gallery + zoom viewer + PDF thumbnail and Open.
- [ ] **T9** Component tests (+ Maestro flow if stable on both platforms).
- [ ] **T10** iOS simulator and Android emulator verification of section 6 items.
- [ ] **T11** Docs: ADR-030 onward, `PHASES.md`, `README.md`, `ARCHITECTURE.md`, `.maestro/README.md`.
- [ ] **T12** Final gate + `npm run doctor` + report.

## Evidence log

| Task | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0   | `git checkout -b feat/phase-2-attachments` from `afe7bed`; baseline gate: see below.                                                                                                                                                                                                                                                                                         |
| T1   | `src/platform/{pickerTypes,imageLibraryPicker,documentPicker,imageProcessor,pdfThumbnail,fileSharer,index}.ts` + `testing/fakes.ts`. Rule probe: a temporary `src/platform/__ruleProbe.ts` importing `../data` failed `deps:check` with `error platform-imports-domain-only`; after deleting it, `✔ no dependency violations found (127 modules, 291 dependencies cruised)`. |
| T2   | `src/domain/attachments.ts` + limits in `src/domain/limits.ts` + `attachments` strings/labels/error codes. `npx jest src/domain` → 5 suites, 40 tests; full gate 28 suites / 174 tests.                                                                                                                                                                                      |

### T0 baseline gate

```
✔ no dependency violations found (119 modules, 285 dependencies cruised)
Test Suites: 27 passed, 27 total
Tests:       162 passed, 162 total
```

`typecheck`, `lint` and `format:check` green (the only first-run failure was Prettier on this new
file, fixed before the commit).

## Decisions taken without asking

_(each one links to its ADR once written)_

- Rows whose file is missing are **kept** and shown as "File missing" rather than deleted.
- Hashing uses `File.digest('SHA-256')` inside the FileStore (file I/O stays in `src/data`); there is
  no separate hashing port in `src/platform`.
- A failed save moves staged files **back** into staging (best effort) before reporting the failure,
  so a retry does not lose the user's attachments; if the move back also fails the files are deleted
  and the sweeper tidies up.

## Device verification

_Filled in during T10; exact commands used are recorded there._
