# Medical History Tracker

A private, offline medical-history app for one family. Everything stays on the device: no backend,
no account, no analytics, no camera, no notifications.

**Status:** Phase 3 (profile and measurements) built: the profile is derived from the newest
measurement of each kind, a "Profile updated" sheet with Undo follows every save, a recorded blood
type is only replaced after confirmation, and the Profile screen has a measurement history with a
trend and standalone measurements. Verified on the iOS simulator and the Android emulator, except
the iOS photo-picker selection (the dev client's floating button intercepts it). See
`docs/PHASE3-PROGRESS.md` for the task-by-task evidence and `docs/DECISIONS.md` (ADR-038 to ADR-046)
for the design. Phases 1 and 2 are complete: manual records with search and filters, and
attachments with a relative-path file store, a startup sweeper and a zoomable viewer.

## Requirements

- Node 24.3+ (or 22.13+), npm
- JDK 17 (`brew install openjdk@17`), `JAVA_HOME` exported
- Android Studio + Android SDK 37 (compileSdk), NDK 27.1.12297006, CMake 3.22.1
- Xcode 27.2+ with the iOS 27 SDK, CocoaPods 1.17+

See `docs/PHASE0-ENV.md` for the exact versions this project was built and verified with.

## Getting started

```bash
npm install
npm run start          # Metro with the dev client
npm run android        # local debug build + install
npm run ios            # local debug build + install
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run deps:check     # layer/dependency rules
npm run doctor         # expo-doctor
```

CI runs the same set on every push (`.github/workflows/ci.yml`).

## Documentation

| File                   | What it covers                                     |
| ---------------------- | -------------------------------------------------- |
| `AGENTS.md`            | Rules for contributors and AI agents               |
| `docs/ARCHITECTURE.md` | Layers, dependency rules, data invariants          |
| `docs/DECISIONS.md`    | ADRs for every non-obvious choice                  |
| `docs/PHASES.md`       | Phase plan and checklist                           |
| `docs/PRIVACY.md`      | What is stored, where, and what leaves the device  |
| `docs/PHASE0-ENV.md`   | Verified toolchain versions                        |
| `docs/TESTING.md`      | Manual test scripts for the simulator and emulator |

## Not committed, ever

`private-samples/` (real documents), signing material, backups. The repository is public and a
pre-commit hook blocks these, along with a wrong git identity.
