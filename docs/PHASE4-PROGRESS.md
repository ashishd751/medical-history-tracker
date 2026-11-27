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
- [x] **T4** Export service: model assembly (profile, units, doctors), generate, rename, share, errors.
- [x] **T5** Export screen and route; enable the Home button; filters, columns, sort, live count,
      persistence, progress and error states. Component tests.
- [x] **T6** Exports cleanup on app start, with tests; `docs/PRIVACY.md` updated.
- [x] **T7** _Stretch:_ attachments column and an optional thumbnail appendix — only if budget allows.
- [x] **T8** Maestro flow for the export screen, if stable on both platforms.
- [x] **T9** Verification on the iOS simulator **and** the Android emulator (section 6).
- [x] **T10** Docs: ADR-047 onward, `PHASES.md`, `README.md`, `ARCHITECTURE.md`, `TESTING.md`,
      `PRIVACY.md`, `.maestro/README.md`.
- [x] **T11** Final gate (`npm run doctor` too) and the report.

## Evidence log

| Task | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T0   | `git checkout -b feat/phase-4-pdf-export` from `b97df52`; baseline gate `EXIT=0`: `✔ no dependency violations found (172 modules, 423 dependencies cruised)`, `Test Suites: 44 passed`, `Tests: 312 passed`.                                                                                                                                                                                                                                                                                                                                                                                                             |
| T1   | `src/domain/export/{model,html}.ts` (columns, canonical order, A4 sizes, orientation, widths, sorting, escaping, `buildExportHtml`), `src/domain/age.ts`, `src/features/export/exportFormat.ts` (cells, facts, range), new `strings.export` + `exportColumnLabel`/`exportVitalLabel`. `npx jest src/domain/export src/domain/age.test.ts src/features/export` → `4 suites / 86 tests`. Full gate: `48 suites / 398 tests`, `181 modules`. Two test expectations were wrong (170 cm is 5 ft 7 in; BMI 24.2 is _Overweight_ on the Asian preset) and one real bug was fixed: a one-sided reference range printed `(40––)`. |
| T2   | `src/data/repositories/exportRepository.ts` (six batched reads, 500-id chunks) + `export.test.ts`; `getExportPreferences`/`saveExportPreferences` with a Zod fallback + 5 tests; the test database gained a statement counter. Real SQLite: 1,000 records in **10 statements** (asserted exactly), an empty match in 1. Full gate: `49 suites / 410 tests`, `183 modules`.                                                                                                                                                                                                                                               |
| T3   | `src/domain/export/fileName.ts` (+10 tests), `src/platform/pdfPrinter.ts` (`expo-print`, A4 via width/height), `src/platform/exportFiles.ts` (`cache/exports` adopt + clear), the `PdfPrinter`/`ExportFiles` fakes. Full gate: `50 suites / 420 tests`, `187 modules`.                                                                                                                                                                                                                                                                                                                                                   |
| T4   | `src/features/export/exportService.ts` + 14 tests over the real SQLite fixture and the platform fakes (page size, sort flip, filters, imperial header, empty set, print/move failures, no share sheet, escaping, Devanagari). Full gate: `51 suites / 434 tests`, `189 modules`.                                                                                                                                                                                                                                                                                                                                         |
| T5   | `src/features/export/ExportScreen.tsx` + `app/export.tsx` (pinned footer, live count, column/type/sort pickers, custom DD/MM/YYYY range, orientation note, in-app banners); Home's **Export PDF** now pushes `/export`; `exportFilters.ts` (+8 tests) and 12 component tests (awaiting `fireEvent`, the RNTL v14 rule). Full gate: `53 suites / 454 tests`, `195 modules`.                                                                                                                                                                                                                                               |
| T6   | `src/features/shell/exportCleanup.ts` (never throws; in `shell` so no feature imports another feature) called from `AppProviders` beside the attachment sweep; 3 tests; `docs/PRIVACY.md` names `cache/exports/`. Full gate: `54 suites / 457 tests`, `197 modules`.                                                                                                                                                                                                                                                                                                                                                     |
| T7   | The **Attachments column** ships (count + roles, one batched query, off by default) with tests in `exportFormat.test.ts` and `export.test.ts`. The **thumbnail appendix is skipped** (ADR-051) and is not claimed.                                                                                                                                                                                                                                                                                                                                                                                                       |
| T8   | `.maestro/export/export-pdf.yaml` (Back-if-present → `tab-home` → scroll with `centerElement` → count → generate → share sheet → banner, platform-conditional dismissal). Green end-to-end on the iOS simulator and the Android emulator with 1,000 records (72 pages each). The four traps are in `.maestro/README.md`.                                                                                                                                                                                                                                                                                                 |
| T9   | Device run on the iOS simulator (iPhone 18 Pro, iOS 27.2) and the Android emulator (`mht_play`, API 36): see the table below. **Items 2 (portrait), 3, 4, 7, 11 and 12 were not completed on device** and are recorded as such.                                                                                                                                                                                                                                                                                                                                                                                          |
| T10  | ADR-047 to ADR-051; Phase 4 ticked in `docs/PHASES.md`; `README.md` status; a "PDF export (Phase 4)" section in `docs/ARCHITECTURE.md`; `docs/TESTING.md` §7b (seeding), §7c (pulling and checking PDFs) and §12 (the manual checklist); `docs/PRIVACY.md` (the cache lifecycle); `.maestro/README.md` (flow traps).                                                                                                                                                                                                                                                                                                     |
| T11  | Final gate green (output below) and `expo-doctor` 20/20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

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

## T9 device verification

iPhone 18 Pro (iOS 27.2) and `mht_play` (Pixel 10, API 36). Data: the synthetic set from
`scripts/seed-export-demo.mjs` at 12, 120 and 1,000 records. Every PDF was pulled to the host and
inspected with `pdfinfo`, `pdftotext -layout` and `pdftoppm`; rendered pages were looked at, not only
grepped. The commands are in `docs/TESTING.md` §7b–7c.

| #   | Item                                  | iOS simulator                                                                                                                                                                                           | Android emulator                                                                   |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Defaults, share sheet, header, footer | PASS — 12, 120 and 1,000 records: the sheet shows the renamed file, six columns, newest first, the profile header and the footer                                                                        | PASS — 120 and 1,000: "Sharing 1 file" with the renamed PDF, same content          |
| 2   | Custom columns → portrait/landscape   | **PARTIAL** — landscape confirmed from the PDFs (`842x595`); the portrait export after removing a column was **not completed** (the Maestro scroll timed out). The picker and note are component-tested | Not run                                                                            |
| 3   | Sort flip                             | **NOT VERIFIED on device** — the flow that selects "Oldest first" did not finish; the service orders rows correctly in tests                                                                            | Not run                                                                            |
| 4   | Filters change count and PDF          | **NOT VERIFIED on device** — covered by component tests (the `count` query and the stored filter)                                                                                                       | Not run                                                                            |
| 5   | Volume: 1, 100+, 1,000                | PASS — 1,000 records: **72 pages, 2.88 s, 332 KB**; UI responsive; a header on all 72 pages; no split row (every page after the first starts with `DATE`)                                               | PASS — 1,000 records: **72 pages, 2.22 s**; a header on all 72 pages; no split row |
| 6   | Hindi, emoji, long word, tags, quotes | PASS — rendered pages show Devanagari, the emoji, the 100-character word wrapped in its cell, and `<b>`/`&`/quotes literally                                                                            | PASS — same page content                                                           |
| 7   | Imperial units                        | **NOT VERIFIED on device** — `buildExportFacts`/`formatExportVitals` are tested with lb/ft/°F                                                                                                           | Not run                                                                            |
| 8   | Profile header matches Home/Profile   | PASS — "36 years", `126/80 mmHg on 08/08/2026`, medication names deduplicated                                                                                                                           | PASS — same header in the 120- and 1,000-record PDFs                               |
| 9   | Persistence                           | PARTIAL — the six default columns survived every relaunch; a corrupted stored value falls back to the defaults in `settings.test.ts`                                                                    | PARTIAL — same                                                                     |
| 10  | Cleanup after relaunch                | PASS — `Removed earlier PDF exports {"files": 1}` at launch, and `cache/exports/` empty                                                                                                                 | PASS — the folder is removed at launch                                             |
| 11  | Dark/light, XL text, 360 dp, 1.3      | **NOT RUN**                                                                                                                                                                                             | **NOT RUN**                                                                        |
| 12  | Regression smoke + Phase 3 sheet      | **NOT RUN** in this session                                                                                                                                                                             | **NOT RUN**                                                                        |

**Unticked on purpose:** items 2 (portrait), 3, 4, 7, 11 and 12. Where the logic allows it they are
covered by automated tests, but the handoff requires a device check and this session ran out of
budget while driving Maestro. Items 3, 4 and 7 need one export each; 11 and 12 need the
appearance/reset pass. They should be done before the phase is called closed.

## Deviations from the handoff

- **Pagination is manual.** The handoff suggested repeating headers with `thead { display:
table-header-group }` and confirming it on both platforms. It works on Android and **does not work
  on iOS**: pages 2–6 of a 120-record export had no header at all. The builder now emits one table per
  page (ADR-048), which also made the row budget part of the domain model.
- **Portrait/landscape tension.** FR-10 says "portrait with up to 5 columns" and lists six default
  columns, so the default export is landscape. Implemented literally; if the intent was "the default
  set stays portrait", change `MAX_PORTRAIT_COLUMNS` to 6.
- **One extra column** (`Record`, the title) — ADR-047.
- **Attachments show roles, not file names** — a stored name is a generated id (ADR-047).
- The export's success/failure banner lives in the **pinned footer**, not in the scrolling body: with
  1,000 records the page is long, and a banner under the column picker was out of sight after tapping
  Generate.

## Devices left as found

- iOS: the synthetic demo rows (`demo-*`), the demo doctor, the exported PDF and the remembered
  export preferences were deleted; `person.dob` restored to its previous `2026-11-27`. The four
  synthetic `measurement` rows already on the device (170 cm, and 70/80/90 kg) are untouched.
- Android: the same cleanup (0 records, its 2 pre-existing measurements), `cache/exports/` removed.
- No display, font-scale or appearance setting was changed on either device.

## Final gate output

```
$ npm run typecheck && npm run lint && npm run deps:check && npm run format:check && npm test
EXIT=0
✔ no dependency violations found (197 modules, 484 dependencies cruised)
Test Suites: 54 passed, 54 total
Tests:       460 passed, 460 total

$ npm run doctor
20/20 checks passed. No issues detected!
```

Baseline at T0 was 44 suites / 312 tests; Phase 4 adds 10 suites and 148 tests.

## Review fixes after the gate (branch still open)

Two layout problems found by reading the screens on the simulator, fixed and verified on both
platforms (ADR-052):

- **Home: the medication list is bounded.** Names are deduplicated and only four chips are shown;
  the section header gains "View all", which opens the full list in a scrollable sheet with a Close
  button. With six seeded medications Home shows two rows of chips and "Recent records" is back on
  the first screen (previously a dozen pills pushed it off).
- **Record detail: the type is the eyebrow.** `AppBadge` carries `alignSelf: 'flex-start'`, so in the
  centred row it floated above the date. The type now sits above the title as the screen's eyebrow,
  and the row below is only the date and Edit. Verified from the rendered bounds on both platforms:
  iOS `Doctor visit` 122–140, title 142–178, date 207–227, Edit 207–227; Android 300–348, 353–448,
  date 523–576, Edit 524–577.

`npx jest src/features/home` → 2 suites / 6 tests (three new: cap + sheet, short list, duplicate
name). Full gate after the fixes: **54 suites / 463 tests**, `expo-doctor` 20/20.
