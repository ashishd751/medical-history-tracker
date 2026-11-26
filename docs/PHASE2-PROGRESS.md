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
- [x] **T3** `src/data/fileStore.ts` over an injected file-system port; tests with the in-memory fake.
- [x] **T4** `attachmentRepository` + `recordRepository.remove()` returns attachment paths; SQLite tests.
- [x] **T5** Attachment service (import pipeline, save/removal ordering, compensation); tests with fakes.
- [x] **T6** Startup sweeper (orphans, staging, rows with missing files); tests.
- [x] **T7** Record form sections (Prescription / Reports and other files) + draft integration.
- [x] **T8** Record detail gallery + zoom viewer + PDF thumbnail and Open.
- [x] **T9** Component tests (+ Maestro flow if stable on both platforms).
- [x] **T10** iOS simulator and Android emulator verification of section 6 items.
- [x] **T11** Docs: ADR-030 onward, `PHASES.md`, `README.md`, `ARCHITECTURE.md`, `.maestro/README.md`.
- [x] **T12** Final gate + `npm run doctor` + report.

## Evidence log

| Task | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0   | `git checkout -b feat/phase-2-attachments` from `afe7bed`; baseline gate: see below.                                                                                                                                                                                                                                                                                         |
| T1   | `src/platform/{pickerTypes,imageLibraryPicker,documentPicker,imageProcessor,pdfThumbnail,fileSharer,index}.ts` + `testing/fakes.ts`. Rule probe: a temporary `src/platform/__ruleProbe.ts` importing `../data` failed `deps:check` with `error platform-imports-domain-only`; after deleting it, `✔ no dependency violations found (127 modules, 291 dependencies cruised)`. |
| T2   | `src/domain/attachments.ts` + limits in `src/domain/limits.ts` + `attachments` strings/labels/error codes. `npx jest src/domain` → 5 suites, 40 tests; full gate 28 suites / 174 tests.                                                                                                                                                                                      |

| T3 | `src/data/fileStore.ts` + `src/data/testing/memoryFileSystem.ts`; `npx jest src/data/fileStore.test.ts` → 9 tests (copy size+checksum, empty copy refused, missing source, move, list, hash, batch delete, dir delete). |

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

## Device verification (T10)

Metro: `npx expo start --dev-client --port 8081`. Apps were already installed (no new native module
was added, so no rebuild was needed).

```bash
# launch
xcrun simctl openurl booted "medicalhistory://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "medicalhistory://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
# files
xcrun simctl addmedia booted /tmp/mht-fixtures/portrait-exif6.jpg ...
adb push /tmp/mht-fixtures/two-page-report.pdf /sdcard/Download/
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/two-page-report.pdf
# storage
adb shell run-as com.ashishd751.medicalhistory ls -R files/
adb shell 'run-as com.ashishd751.medicalhistory cat files/SQLite/medical-history.db' > mht.db
python3 -c "import sqlite3; print(list(sqlite3.connect('mht.db').execute('select id,rel_path,thumb_rel_path,mime,bytes,length(sha256) from attachment')))"
```

| #   | Check                                         | Android emulator (API 36)                                                                                                                                                                                                                                               | iOS simulator (27.2)                                                                                                                             |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | No camera                                     | Installed APK requests only `ACCESS_LOCAL_NETWORK` + `SYSTEM_ALERT_WINDOW` (`adb shell dumpsys package`); manifest entry is `tools:node="remove"`; picking opened `com.google.android.photopicker` ("will only have access to the photos you select"), no camera option | `Info.plist` has no `NSCameraUsageDescription` (only `NSPhotoLibraryUsageDescription`)                                                           |
| 2   | Pick image, save, reopen, zoom                | Done: photo picked, thumbnail in the form, saved, detail gallery showed the tile, viewer opened, **double-tap zoom** changed the framing (before/after screenshots)                                                                                                     | **Not completed**: the form and both sections render, but tapping Add photo/Add file produced no picker and no error banner; needs a manual pass |
| 3   | EXIF orientation 6                            | Stored file is **1000×1400** JPEG from a 1400×1000 source with orientation 6, and carries no `Exif` segment                                                                                                                                                             | Not reached                                                                                                                                      |
| 4   | Large image / HEIC / transparent PNG          | Not exercised on the device (covered by unit tests: the pipeline asks for a 2000 px long edge and re-encodes above 1.5 MB)                                                                                                                                              | Not reached                                                                                                                                      |
| 5   | PDF thumbnail + Open                          | First page rendered to a 282×400 JPEG thumbnail from a 420×595 pt page; the Open action was not exercised because selecting a PDF from `documentsui` under automation kept returning to the picker                                                                      | Not reached                                                                                                                                      |
| 6   | Persistence, incl. staged files across a kill | Done: `adb shell am force-stop`, relaunch → record and attachment still there. A second draft with a staged photo survived `force-stop`; on relaunch the form restored the tile and `staging/<draftId>/…` was **not** swept                                             | Not reached                                                                                                                                      |
| 7   | Delete record deletes files                   | Done: after Delete + confirm, `files/attachments/**` and `files/thumbs/**` were empty and `select count(*) from attachment` = 0; after the next launch the sweeper removed the empty folders                                                                            | Not reached                                                                                                                                      |
| 8   | Cancel / denial                               | Cancel was exercised repeatedly (picker dismissed, no banner). Limited access is shown by the picker itself; the "limited" banner is covered by the service test                                                                                                        | Not reached                                                                                                                                      |
| 9   | Themes and sizes                              | Android light at default font scale; 360 dp + 1.3 font scale not exercised                                                                                                                                                                                              | iOS **dark** verified on Home, record form and detail                                                                                            |

Also verified on Android: the record draft guard (Back → "Discard changes?"), and the startup
sweeper removing empty attachment folders after the record was deleted.

## Tests and gate (T11, T12)

- Final gate: `npm run typecheck && npm run lint && npm run deps:check && npm run format:check && npm test`
- `npm run doctor`

```
typecheck   clean
lint        clean (0 warnings)
deps:check  ✔ no dependency violations found (153 modules, 365 dependencies cruised)
format:check All matched files use Prettier code style
test        36 suites, 224 tests passed
doctor      20/20 checks passed
```

| T12 | Final gate green: 36 suites / 224 tests, 153 modules clean, doctor 20/20. |

## Cleanup

- Synthetic records created for these checks were deleted through the app (record + attachment rows
  - files), and the draft used for the kill test was discarded.
- `adb shell rm` removed every pushed fixture from `Pictures/` and `Download/`.
- The iOS simulator photo library keeps the three synthetic images added with `simctl addmedia`;
  they are invented images and could not be removed without a GUI.
- No device setting (font scale, density, appearance) was changed. The Android app was re-launched
  and the iOS app terminated.
