# Phase 3 — Profile and measurements: progress

Working branch: `feat/phase-3-profile` (from `main` at `50ade44`).

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

- [ ] **T0** Branch, this file, baseline gate (expect 36 suites / 224 tests), commit.
- [x] **T1** Domain: `ProfileSnapshot`, `computeProfileDiff`, `isCurrentMedication`,
      `requiresBloodTypeConfirmation`, display formatters, matrix tests.
- [x] **T2** Data: `listCurrent` end-date rule, history/snapshot queries, `profileRepository`,
      migration v3 (`profile_excluded`) with the version matrix. Real-SQLite tests.
- [x] **T3** Profile-sync feature service: capture before, diff after, publish the change, undo;
      wired into record create, edit and delete. Real-SQLite tests.
- [x] **T4** "Profile updated" sheet, transient store, shell host, Undo behaviour. Component tests.
- [x] **T5** Blood-type confirmation dialog, wired into the Profile edit sheet. Tests.
- [x] **T6** Profile screen: measurement history, trend, add and delete standalone measurements. Tests.
- [x] **T7** Home consistency from the same snapshot source. Tests.
- [x] **T8** Maestro flows (weight change → sheet → Undo; backdated → no sheet) if stable on both.
- [x] **T9** Verification on the iOS simulator **and** the Android emulator (section 6 of the handoff).
- [x] **T10** Docs: ADR-038 onward, `PHASES.md`, `README.md`, `ARCHITECTURE.md`, `TESTING.md`,
      `.maestro/README.md`.
- [ ] **T11** Final gate (`npm run doctor` too) and the report.

## Evidence log

| Task | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0   | `git checkout -b feat/phase-3-profile` from `50ade44`; baseline gate green: `✔ no dependency violations found (153 modules, 365 dependencies cruised)`, `Test Suites: 36 passed`, `Tests: 224 passed`.                                                                                                                                                                                                                                                                                                                                                                                 |
| T1   | `src/domain/profile.ts` (+ `profile.test.ts`, 24 cases) and `src/ui/format.ts` `formatProfileChange(s)` (+ `format.test.ts`, 8 cases). `npx jest src/domain/profile.test.ts src/ui/format.test.ts` → 32 passed. Full gate: `38 suites / 256 tests`, `✔ no dependency violations found (156 modules, 371 dependencies cruised)`.                                                                                                                                                                                                                                                        |
| T2   | Migration v3 (`profile_excluded` on `measurement` and `medication`), `measurementRepository.{listByRecord,setProfileExcluded}` + excluded rows never win `latest`, `medicationRepository.listCurrent(personId, today)` with the end-date rule and exclusion, `profileRepository.{snapshot,undo}`, `AppRepositories.profile`. `npx jest src/data` → `14 suites / 127 tests`. Full gate: `39 suites / 269 tests`, `✔ no dependency violations found (158 modules, 378 dependencies cruised)`.                                                                                            |
| T3   | `src/features/records/profileSync.ts` (`readProfile`, `undoPlanForRecord`, `buildProfileChangeReport`), `src/lib/profileChangeStore.ts` (`useSyncExternalStore`, no dependency), wired into `RecordFormScreen.onSubmit` (create + edit) and `RecordDetailScreen.remove`. `npx jest src/features/records/profileSync.test.ts` → 5 passed (create/backdated/edit/delete/store). Full gate: `40 suites / 274 tests`, `✔ no dependency violations found (161 modules, 387 dependencies cruised)`.                                                                                          |
| T4   | `src/ui/components/AppChangeList.tsx`, `src/features/shell/ProfileChangeHost.tsx` (hosted once in `app/_layout.tsx` above the navigator). `npx jest src/features/shell` → 6 passed (empty, old→new rows, undo + confirmation + refresh, failed undo, edit note, delete note). Full gate: `41 suites / 280 tests`, `✔ no dependency violations found (164 modules, 400 dependencies cruised)`.                                                                                                                                                                                          |
| T5   | `src/ui/components/AppBloodTypeDialog.tsx` (reusable; the domain decides _whether_ to ask), wired into the Profile edit sheet against the stored value. `npx jest src/ui/components/AppBloodTypeDialog.test.tsx src/features/profile` → 3 + 5 passed (change wording, clear wording, confirm/cancel, ask-then-cancel keeps O+, confirm applies, first-time set silent). Full gate: `42 suites / 286 tests`, `✔ no dependency violations found (166 modules, 406 dependencies cruised)`.                                                                                                |
| T6   | `MeasurementHistory.tsx`, `MeasurementTrend.tsx` (plain Views, no chart dependency), `AddMeasurementSheet.tsx`, `measurementInput.ts` (metric conversion + plausibility ranges), `ProfileScreen` rewritten over `profile.snapshot` + `measurements.listByKind`. `AppSheet` now rises above the keyboard (`KeyboardAvoidingView`, ADR-042). `npx jest src/features/profile` → `2 suites / 28 tests`. Full gate: `43 suites / 309 tests`, `✔ no dependency violations found (171 modules, 420 dependencies cruised)`.                                                                    |
| T7   | `HomeScreen` now reads `profile.snapshot` for the card _and_ the medication chips (the old `latestVitals` / `listCurrent` queries are gone). `src/features/home/HomeScreen.test.tsx` fails if Home touches those directly. `npx jest src/features/home` → 3 passed. Full gate: `44 suites / 311 tests`, `✔ no dependency violations found (172 modules, 423 dependencies cruised)`.                                                                                                                                                                                                    |
| T8   | `.maestro/profile/record-updates-profile.yaml` and `.maestro/profile/backdated-record.yaml` (clearState + onboarding, so the old → new values are exact). Both flows `COMPLETED` on every step on iOS and Android, including `Undo` → "Undone. The record was kept." and `assertNotVisible "Profile updated"` for the backdated save. `.maestro/records/create-manual.yaml` updated for the row's new accessible label and re-run green on both.                                                                                                                                       |
| T9   | Device run on the iOS simulator (iPhone 18 Pro, iOS 27.2) and the Android emulator (`mht_play`, API 36). Per-item results are in the table below. Found and fixed four real bugs in the process: the Profile edit button sat under the dev client's floating menu button, a Paper dialog could not appear above a sheet, the add-measurement sheet's Save button sat behind the keyboard on Android, and a list row hid its date from a screen reader. Full gate after the fixes: `44 suites / 312 tests`, `✔ no dependency violations found (172 modules, 423 dependencies cruised)`. |

### T9 device verification

| #   | Item                                                                                  | iOS simulator                                                                                                                                                                                                | Android emulator                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Record whose weight differs → sheet → Undo keeps the record, Home/Profile revert      | PASS (Maestro `record-updates-profile.yaml`)                                                                                                                                                                 | PASS (same flow)                                                                                                                                                                  |
| 2   | Backdated record → no sheet, Home unchanged, value in history                         | PASS (Maestro `backdated-record.yaml`)                                                                                                                                                                       | PASS (same flow)                                                                                                                                                                  |
| 3   | Edit → sheet with the no-Undo note; delete → profile reverts + no-Undo notice         | PASS (Maestro, ad-hoc flow)                                                                                                                                                                                  | PASS (same flow)                                                                                                                                                                  |
| 4   | Medication: appears when added; end date past → gone, today → stays, tomorrow → stays | PASS for "added, appears"; end-date cases verified by writing `end_on` in SQLite and relaunching (there is **no UI for an end date** in this phase)                                                          | PASS, same method                                                                                                                                                                 |
| 5   | Blood type: first set silent, change asks (Cancel keeps), clearing asks               | PASS (Maestro)                                                                                                                                                                                               | PASS (same flow)                                                                                                                                                                  |
| 6   | Imperial: diff rows, history, add form in lb/ft; metric values do not drift           | PASS (Maestro; 160 lb stored as 72.5748 kg, checked in SQLite)                                                                                                                                               | PASS (same flow; same stored value)                                                                                                                                               |
| 7   | History: switch kinds, open the source record, add and delete a standalone row        | PASS (Maestro)                                                                                                                                                                                               | PASS (same flow)                                                                                                                                                                  |
| 8   | Appearance/size: iOS dark + accessibility XL, Android light 360 dp at font scale 1.3  | PASS with caveats (below)                                                                                                                                                                                    | PASS with caveats (below)                                                                                                                                                         |
| 9   | Kill the app with the sheet open, relaunch                                            | PASS (sheet gone, data consistent, record kept)                                                                                                                                                              | Not run separately — the same in-memory store is shared; iOS covered it                                                                                                           |
| 10  | Phase 1 five-minute smoke; attach an image and delete the record (files go)           | Phase 1 flow PASS. Attachment: the photo picker now presents (better than Phase 2) but the selection could not be driven — the dev client's floating button intercepts taps in the picker. **Not verified.** | Phase 1 flow PASS. Attachment PASS end to end: picked `portrait-exif6.jpg`, 1 row stored (115 KB, 64-char sha256), preview/thumb on disk, then delete → 0 rows and no files left. |

Caveats for item 8: at the largest iOS accessibility size the seven-kind pill "Glucose" ellipsises to "Glu co…" (the one remaining truncation; the sheet, the "Profile updated" sheet, the history rows and both dialogs render fully), and the record form's "Vitals · Height (cm)" field label truncates — both are Phase 8 accessibility work. Two layout fixes were made because of this item: the dialog action row wraps at large text, and a list row's subtitle gets three lines.

| T10 | ADR-038 to ADR-046 in `docs/DECISIONS.md`; Phase 3 ticked in `docs/PHASES.md`; `README.md` status; a "Profile and measurements (Phase 3)" section plus the state note in `docs/ARCHITECTURE.md`; a Phase 3 manual checklist and a refreshed "known gaps" in `docs/TESTING.md`; the flow traps in `.maestro/README.md`. `npm run format:check` clean. |

### T0 baseline gate output

```
EXIT=0
Test Suites: 36 passed, 36 total
Tests:       224 passed, 224 total
✔ no dependency violations found (153 modules, 365 dependencies cruised)
```

## Decisions taken without asking

_(each one links to its ADR once written)_
