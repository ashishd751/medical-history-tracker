# Phase 1 bugfix pass — progress

Branch `bugfix/phase-1`, based on `a9a4c46 "fix(ui): phase-1 interim fixes"` (which is `main@64f4c7a`
plus the interim UI commit). One task per commit; the gate runs before every commit:

```bash
npm run typecheck && npm run lint && npm run deps:check && npm run format:check && npm test
```

Baseline at `a9a4c46`: typecheck, lint, dependency rules (106 modules) and Prettier pass; Jest is
**17 suites / 125 tests**. Nothing in this pass has been verified on a device.

## Checklist

- [x] **T1. Progress file and baseline.** Gate re-run at `a9a4c46`: 17 suites / 125 tests pass.
- [x] **T2. Fix R3 (double bottom inset).** `AppScreen` pads the bottom only with the new opt-in
      `safeAreaBottom` prop, set on `RecordFormScreen` and `OnboardingScreen`; Records has no extra
      gap. `AppScreen.test.tsx` (4 tests) checks both cases.
- [x] **T3. Fix R4 (record count).** `records.count(personId, filter?)` shares the list's `WHERE`
      predicate; the Records header shows the total, not `rows.length`. Count test (30 matches, 25
      loaded, filters + person scoping) passes.
- [x] **T4. Fix R5 (tab label token).** `typography.tabLabel` (15/20) replaces the hard-coded size;
      labels are `numberOfLines={1}` with OS scaling capped at 1.2 so "Settings" fits its ~72 dp
      slot on a 360 dp phone. `AppTabBar.test.tsx` checks the token and both props.
- [x] **T5. Redesign the Profile page (R1).** New `AppFactGrid` in `src/ui`: two-column tiles (DOB |
      Sex, Blood type | BMI + badge, Height | Weight) and full-width rows for Allergies and Chronic
      conditions. The edit sheet uses `AppChoiceGrid` (4 columns); `testID`s and DD/MM/YYYY kept.
- [x] **T6. Tests (R6).** Repository FTS tests (person scoping, doctor name, case, mid-word, 12 hostile
      needles), person-cascade FTS test, `rebuildSearchIndex` test, `AppChoiceGrid` tests (single,
      multi, keyboard) and a Profile layout test. The hostile-input test found and fixed a real
      defect: a `"` search matched every record with symptoms because the raw JSON was scanned.
- [x] **T7. Search benchmark.** `npm run bench:search` seeds 20,000 synthetic records (10,000 per
      person) and reports median/p95 for instr vs FTS. Run on Node 24.14 / SQLite 3.51.2:
      common `ache` page 0.12 ms vs 1.04 ms (the old scan early-exits); rare `sarcoidosis` page
      8.01 ms vs 0.33 ms (24×); common count 5.95 ms vs 1.74 ms (3.4×); rare count 7.63 ms vs
      0.27 ms (28×). The benchmark exposed a bad plan in the original FTS query shape (440 ms,
      probing the index per row); the repository now uses `record.rowid IN (SELECT rowid …)`.
- [x] **T8. Debounce (R8).** `useDebouncedValue` (250 ms) now gates the search queries in the
      Records screen; an empty box applies immediately so Clear filters stays snappy. Two hook tests
      cover the delay and the restart. Maestro never types into search, so the flow is unaffected.
- [x] **T9. Documentation (R2).** ADR-023 (FTS5 trigram, benchmark, rowid/VACUUM trap),
      ADR-024 (pagination + count; answers open question 1), ADR-025 (`AppChoiceGrid`),
      ADR-026 (bottom safe-area rule), ADR-027 (filters, debounce, tab label, Profile). `PHASES.md`
      (bugfix sub-list; Phase 8 pagination removed), `README.md` (status, 23 suites / 155 tests),
      `ARCHITECTURE.md` (search index, UI system, async RNTL), `AGENTS.md` (no `VACUUM`).
- [x] **T10. Final gate and report.** Final gate green on this tree: typecheck, lint, dependency rules
      (115 modules), Prettier, **24 suites / 159 tests** after the device-QA fixes below. Nothing was
      pushed.

## Device QA — 26 Nov 2026

Environment from `private-samples/TESTING_WITH_SIMULATOR_EMULATOR.md`: iPhone 18 Pro simulator (iOS
27.2, UDID `D65428AF-…`) and Pixel 10 AVD `mht_play` (Android 16 / API 36, `emulator-5554`), Maestro
2.12.1. All data used was synthetic; the seeded rows were deleted afterwards and both devices were
returned to their previous settings (iOS dark + Large text; Android density 420, font 1.0).

### Passed

- **iOS upgrade in place:** a v1 database (1 person, 2 vitals, 0 records) migrated to `user_version = 2`
  on launch; the person and vitals survived; `record_fts` and its three triggers exist afterwards.
- **Search, both platforms:** `ache` → 3 records (mid-word), `sarcoidosis` → 1 (rare), `quillon` → 1
  (doctor name through the subquery, not the FTS index). The 250 ms debounce settles and the count
  matches the rows.
- **Pagination, both platforms:** with 32 seeded records the header says `32 records`; scrolling revealed
  `Synthetic follow-up 24` and then `Synthetic follow-up 11`, i.e. page 2 loaded with month headers
  intact.
- **Android end-to-end:** the existing `.maestro/records/create-manual.yaml` passed unchanged —
  onboarding (chips, Next/Finish clear of the gesture bar), create a record, `1 record`, edit, delete,
  `0 records`, `DD/MM/YYYY` visible and no ISO date.
- **Themes:** iOS dark and light (Home, Records, Profile, form); Android light.
- **Tab labels at 360 dp:** Android density 480 (360 dp) with font scale 1.3 — Home, Records, Profile and
  Settings all on one line, five even slots, no ellipsis.
- **Profile:** two-column tiles fill the card on iOS (dark/light) and Android (light, 360 dp/1.3×);
  long values wrap instead of overflowing.
- **Form:** kind chips fill the row; Save is fully visible above the home indicator on iOS and above the
  gesture bar on Android; with the keyboard dismissed the footer sits at the bottom.
- **Cleanup:** both databases read back with 0 records after cleanup and the app opened normally.

### Failed, then fixed (commits `b5191e7`, `8bc4e9e`)

- **Save hidden by the software keyboard (Android).** With the emulator's keyboard open, the pinned
  footer was entirely behind it: the edge-to-edge window does not resize. `AppScreen` now wraps the body
  of `safeAreaBottom` screens in a `KeyboardAvoidingView`; re-checked on the emulator with the keyboard
  open — Save sits directly above it. Unit test asserts the wrapper exists only for opt-in screens.
- **Profile date broken at accessibility XL (iOS).** At the largest iOS text size, two-column tiles
  wrapped `25/11/2026` as `25/11/2` / `026`. `AppFactGrid` now collapses to one column when
  `fontScale >= 1.5`; re-checked at accessibility XL — the date stays whole. Unit test covers both
  column modes.

### Known limitation, not fixed

- At accessibility XL the record-row kind badge wraps inside its pill and a long title ellipsises. That
  is the pre-existing `AppListRow` / `AppBadge` design, untouched by this pass; noted for the Phase 8
  accessibility audit.

## Assumptions and notes

- The branch is the only place for this work; nothing is pushed, merged or opened as a PR.
- Code already cites **ADR-023** (FTS search) and **ADR-024** (pagination); those numbers are kept.
- Maestro asserts the exact strings `1 record` and `0 records`
  (`.maestro/records/create-manual.yaml`); the count work must keep them valid.
