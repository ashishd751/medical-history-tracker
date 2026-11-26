# Medical History Tracker

A private, offline medical-history app for one family. Everything stays on the device: no backend,
no account, no analytics, no camera, no notifications.

**Status:** Phase 1 (data core and manual records) complete, including its review pass: a paginated
timeline, FTS5 symptom search, truthful result counts and the UI fixes from the review (ADR-023 to
ADR-029). 27 Jest suites / 162 tests. No file attachments yet (Phase 2).

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

| File                   | What it covers                                    |
| ---------------------- | ------------------------------------------------- |
| `AGENTS.md`            | Rules for contributors and AI agents              |
| `docs/ARCHITECTURE.md` | Layers, dependency rules, data invariants         |
| `docs/DECISIONS.md`    | ADRs for every non-obvious choice                 |
| `docs/PHASES.md`       | Phase plan and checklist                          |
| `docs/PRIVACY.md`      | What is stored, where, and what leaves the device |
| `docs/PHASE0-ENV.md`   | Verified toolchain versions                       |

## Not committed, ever

`private-samples/` (real documents), signing material, backups. The repository is public and a
pre-commit hook blocks these, along with a wrong git identity.
