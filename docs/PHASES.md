# Phases

Each phase ends at a **gate**: acceptance items met, checks green, report delivered, then a pause for
approval. Never start the next phase unprompted.

## Phase 0 — Foundations and spikes

- [x] Scaffold Expo SDK 58 + Expo Router + TypeScript strict
- [x] ESLint (flat) + Prettier + Husky + lint-staged + commitlint
- [x] dependency-cruiser rules for the layer model
- [x] GitHub Actions CI (doctor, typecheck, lint, dependency rules, tests)
- [x] Design tokens, Paper theme, base `ui/` components
- [x] `lib/` primitives: Result, errors, logger, ids (UUIDv7), dates
- [x] Unit tests for `lib/` (17 tests)
- [x] Android prebuild + no-camera manifest verification
- [x] `expo-doctor` 20/20
- [x] Spike (a) Paper renders identically on Android + iPhone
- [x] Spike (b) expo-sqlite + Drizzle migration on device
- [x] Spike (c) new FileSystem API write/read/delete on device
- [x] Spike (d) library-only image picker + document picker on device (no camera prompt)
      — verified on both: iOS "Private Access to Photos", Android "will only have access to the photos
      you select". No camera prompt on either; selection round-trips on both.
- [x] Spike (e) PDF → images (`react-native-pdf-thumbnail`, ADR-015)
- [x] Spike (f) OCR candidate accuracy on real samples (ADR-015, ADR-016)
- [x] Spike (g) expo-print HTML → PDF
- [x] Spike (h) zip/unzip a 50-file folder
- [x] Spike (i) formulary dataset licence check → RxNorm (ADR-009)
- [ ] Gate report

## Phase 1 — Data core and manual records

- [x] Drizzle schema + migrations for all tables; repositories; person scoping
- [x] First-launch onboarding
- [x] Create/edit/delete record with every field
- [x] Home snapshot card, records timeline with search/filters, record detail
- [x] Repository + migration tests; Maestro manual-create flow
- [x] All user-facing dates render as `DD/MM/YYYY` (ADR-017); no raw `YYYY-MM-DD` visible anywhere
- [x] Bugfix pass on `bugfix/phase-1` (see `docs/PHASE1-BUGFIX-PROGRESS.md`):
  - [x] Records timeline pagination: 25-row pages, one month header across page boundaries (ADR-024).
        **Phase 8 no longer needs pagination.**
  - [x] FTS5 trigram search over records, trigger-maintained index, `rebuildSearchIndex()` (ADR-023)
  - [x] Truthful result count in the Records header (`records.count`, same predicate as the list)
  - [x] Tab labels: `typography.tabLabel` (15/20), one line, capped font scaling (ADR-027)
  - [x] Filters in the list header; 250 ms search debounce (ADR-027)
  - [x] `AppChoiceGrid` full-width choices on the form, onboarding, settings, filters and profile
        (ADR-025)
  - [x] `AppScreen` bottom inset only on pinned-footer screens (ADR-026)
  - [x] Profile uses the full width: two-column fact grid plus full-width medical rows
  - [x] Component tests, a search benchmark (`npm run bench:search`) and the docs to match
  - [x] Follow-up review: Home snapshot grid, record-title hierarchy, dialog radius (ADR-028)

## Phase 2 — Attachments

- [x] Library image + PDF/file pickers, compression, thumbnails, SHA-256 (ADR-030 to ADR-032)
- [x] Relative-path FileStore, orphan sweeper, zoomable viewer (ADR-034, ADR-035)
- [x] Prescription "upload image or type" control
- [x] Files survive restart; deleting a record deletes its files; still no camera permission
      — verified on the Android emulator (EXIF upright, resize, checksum, staging across a kill,
      cascade delete, sweeper); see `docs/PHASE2-PROGRESS.md`. The iOS photo picker did not present
      under automation in this session and still needs a manual pass.

## Phase 3 — Profile and measurements (MVP)

- [x] Measurement history, BMI, BP categories, current-medication rule
      — `profileRepository.snapshot()` derives everything from `measurement` rows; `listCurrent` now
      applies the end-date rule (ADR-038, ADR-043).
- [x] `computeProfileDiff` + "Profile updated" sheet with Undo
      — Undo flags rows out of the profile instead of deleting them (ADR-039 to ADR-041).
- [x] Blood-type confirmation, backdated-record behaviour
      — a recorded group is only replaced after an explicit confirmation (ADR-044).
- [x] Profile screen with history
      — kind picker, trend from plain Views, standalone measurements with delete (ADR-045).
      Verified on the iOS simulator and the Android emulator; see `docs/PHASE3-PROGRESS.md` for the
      per-item results and the two remaining large-text truncations (Phase 8).

## Phase 4 — PDF export

- [ ] Column picker, filters, sort order, profile header, landscape logic, repeated headers
- [ ] Share via expo-sharing; verified on both platforms; 100+ records

## Phase 5 — Backup and migration

- [ ] Zip bundle with manifest + checksums
- [ ] Import preview, Replace/Merge, atomic import
- [ ] Round trip Android → iPhone → Android lossless; corrupted file rejected safely

## Phase 6 — Scan to fill (printed documents)

- [ ] Tier 1 OCR adapter, staging/normalise, PDF pages, classifier
- [ ] Lab + prescription parsers, formulary matcher
- [ ] Review form with Check chips and general banner

## Phase 7 — Handwriting hardening

- [ ] Handwriting detection + user override
- [ ] Persistent handwriting banner, save gate, candidate chips
- [ ] Thresholds tuned on real samples; honest accuracy table in DECISIONS.md

## Phase 8 — Polish and release

- [ ] Records table view; accessibility audit; empty/error states; dark mode (pagination already shipped
      in Phase 1, ADR-024)
- [ ] Signed APK + iOS build; `docs/RELEASE.md`; no camera permission; no network calls
- [ ] Install on a family phone using the written instructions

## Phase 9 — Optional vision engines

- [ ] Tier 2 on-device VLM spike
- [ ] Tier 3 bring-your-own-key cloud spike (off by default, per-upload consent, secure key storage)
- [ ] Accuracy comparison against Tier 1
