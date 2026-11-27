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
- [ ] **T1** Domain: column model, sorting, HTML escaping, `buildExportHtml`, orientation, footer and
      profile header. Tests (defaults, 0/1/many rows, hostile input, long words, Hindi, emoji).
- [ ] **T2** Data and settings: bulk export loader (batched, no cap) and the export preference keys
      with Zod fallbacks. Real-SQLite tests, including 1,000 synthetic records and a query count.
- [ ] **T3** Platform: `PdfPrinter` port (`expo-print` impl + fake), `ExportFiles` port, file-naming
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

| Task | Evidence                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T0   | `git checkout -b feat/phase-4-pdf-export` from `b97df52`; baseline gate `EXIT=0`: `✔ no dependency violations found (172 modules, 423 dependencies cruised)`, `Test Suites: 44 passed`, `Tests: 312 passed`. |

## Decisions taken without asking

_(each one links to its ADR once written)_
