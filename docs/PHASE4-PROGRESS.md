# Phase 4 — PDF export: progress

Working branch: `feat/phase-4-pdf-export` (from `main` at `b97df52`, Phase 3 merged as PR #3).

Rules for this file: one tick per finished task, with one line of **evidence** (the command and its
result, or the file that proves it). A task is not ticked until its gate has run **and**, for anything
that touches UI, files or native modules, it has been exercised on the iOS simulator and the Android
emulator. If a check fails or cannot be run, the box stays unticked and the reason is written under it.
If a session runs out of context, the next session resumes from the first unticked box.

Gate for every commit:

```bash
npm run typecheck && npm run lint && npm run deps:check && npm run format:check && npm test
```

## Checklist

- [x] **T0** Branch, this file, baseline gate (expect 44 suites / 312 tests), commit.
- [x] **T1** Domain: column model, sorting, HTML escaping, `buildExportHtml`, orientation, footer and
      profile header. Tests (defaults, 0/1/many rows, hostile input, long words, Hindi, emoji).
- [x] **T2** Data and settings: bulk export loader (batched, no cap) and the export preference keys
      with Zod fallbacks. Real-SQLite tests, including 1,000 synthetic records and a query count.
- [x] **T3** Platform: `PdfPrinter` port (`expo-print` impl + fake), `ExportFiles` port, file-naming
      helper; reuse `FileSharer`.
- [ ] **T4** Export service: model assembly (profile, units, doctors), generate, rename, share, errors.
- [ ] **T5** Export screen and route; enable the Home button; filters, columns, sort, live count,
      persistence, progress and error states. Component tests.
- [ ] **T6** Exports cleanup on app start, with tests; `docs/PRIVACY.md` updated.
- [ ] **T7** _Stretch:_ attachments column and an optional thumbnail appendix — only if budget allows.
- [ ] **T8** Maestro flow for the export screen, if stable on both platforms.
- [ ] **T9** Verification on the iOS simulator **and** the Android emulator (section 6).
- [ ] **T10** Docs: ADR-047 onward, `PHASES.md`, `README.md`, `ARCHITECTURE.md`, `TESTING.md`,
      `PRIVACY.md`, `.maestro/README.md`.
- [ ] **T11** Final gate (`npm run doctor` too) and the report.

## Evidence log

| Task | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T0   | `git checkout -b feat/phase-4-pdf-export` from `b97df52`; baseline gate `EXIT=0`: `✔ no dependency violations found (172 modules, 423 dependencies cruised)`, `Test Suites: 44 passed`, `Tests: 312 passed`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T3   | `src/domain/export/fileName.ts` (+10 tests), `src/platform/pdfPrinter.ts` (`expo-print`, width/height page size), `src/platform/exportFiles.ts` (`cache/exports` adopt + clear), `PdfPrinter`/`ExportFiles` fakes in `platform/testing/fakes.ts`, exports re-exported from `platform/index.ts`. Full gate: `50 suites / 420 tests`, `187 modules`.                                                                                                                                                                                                                                                                                                                                         |
| T2   | `src/data/repositories/exportRepository.ts` (six batched reads, 500-id chunks) + `export.test.ts`; `settingsRepository.getExportPreferences/saveExportPreferences` with Zod fallback + 5 tests; `testDatabase` gained a statement counter. Real SQLite: 1,000 records loaded in **10 statements** (asserted exactly), empty filter match in 1. `npx jest src/data/repositories/export.test.ts src/data/repositories/settings.test.ts` → `2 suites / 19 tests`. Full gate: `49 suites / 410 tests`, `183 modules`.                                                                                                                                                                          |
| T1   | `src/domain/export/{model,html}.ts` (columns, canonical order, A4 sizes, orientation, widths, sorting, escaping, `buildExportHtml`), `src/domain/age.ts`, `src/features/export/exportFormat.ts` (cells, facts, range), new `strings.export` + `exportColumnLabel`/`exportVitalLabel`. `npx jest src/domain/export src/domain/age.test.ts src/features/export` → `4 suites / 86 tests`. Full gate: `48 suites / 398 tests`, `✔ no dependency violations found (181 modules, 439 dependencies cruised)`. Two test-only expectations were wrong (170 cm is 5 ft 7 in; BMI 24.2 is _Overweight_ on the Asian preset) and one real bug was fixed: a one-sided reference range printed `(40––)`. |

## Decisions taken without asking

_(each one links to its ADR once written)_

- The PDF's **layout** (columns, escaping, sorting, page size) is pure domain code, but the **cell
  text** lives in `src/features/export/exportFormat.ts`: formatting a height needs `cm`/`ft` and a
  measurement needs its label, and the domain layer owns no display string (ADR-047).
- A **Record** column (the record's title) is added as a thirteenth, optional column. FR-10's list
  omits the title, which is the only field that names a lab panel or a vaccination, so the default
  export of a `lab_test` would not say what was tested. Defaults stay exactly as FR-10 lists them.
- A High/Low flag is written as the word (`— High`); `Normal` and `Not flagged` are omitted from the
  compact cell so the two abnormal results in a panel are the ones the eye lands on.
