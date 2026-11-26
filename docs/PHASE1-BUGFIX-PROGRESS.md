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
- [ ] **T7. Search benchmark.** `npm run bench:search`, numbers recorded for ADR-023.
- [ ] **T8. Debounce (R8).** Only if trivial; otherwise recorded as not done.
- [ ] **T9. Documentation (R2).** ADR-023 to ADR-027, `PHASES.md`, `README.md`,
      `ARCHITECTURE.md`, `AGENTS.md`, test counts.
- [ ] **T10. Final gate and report.** Full gate output plus the manual device QA checklist.

## Assumptions and notes

- The branch is the only place for this work; nothing is pushed, merged or opened as a PR.
- Code already cites **ADR-023** (FTS search) and **ADR-024** (pagination); those numbers are kept.
- Maestro asserts the exact strings `1 record` and `0 records`
  (`.maestro/records/create-manual.yaml`); the count work must keep them valid.
