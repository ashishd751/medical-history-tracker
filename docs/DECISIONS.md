# Decisions (ADRs)

Short records of non-trivial choices. Newest last. Format: context, options, decision, consequences.

---

## ADR-001 Git identity is repo-local

**Context.** The machine's global `user.email` is the user's work address; this repository is
public and personal. An earlier commit was authored with the work address.

**Options.** (a) change global identity, (b) repo-local override, (c) per-repo `includeIf` blocks.

**Decision.** (b) Repo-local `user.email = ashishd751@gmail.com`; global config untouched because
work repositories rely on it. A pre-commit hook fails the commit if the identity is wrong.

**Consequences.** New personal repos must set this again; the hook makes the mistake loud. The
original commit was rewritten (author + committer) and force-pushed with `--force-with-lease`.

---

## ADR-002 JDK 17 from Homebrew instead of Azul Zulu

**Context.** Expo/React Native document Azul Zulu 17. The cask is a `.pkg` installer requiring sudo;
this environment has no passwordless sudo.

**Options.** (a) Zulu cask (needs password), (b) Homebrew `openjdk@17` keg-only (no sudo),
(c) system JDK 26 (installed, unsupported — RN warns "problems using higher JDK versions").

**Decision.** (b). `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
exported from `~/.zshrc`. Same JDK major version, different distribution.

**Consequences.** Gradle/AGP 9 build against JDK 17. Android Studio's bundled JBR should be pointed
at the same JDK for consistency. Switching to Zulu later is one command and changes nothing else.

---

## ADR-003 `exactOptionalPropertyTypes` is disabled

**Context.** The spec asks for it "if practical". React Native 0.88 and React Native Paper 5.15
declare props as `testID?: string` rather than `testID?: string | undefined`, so passing a
conditionally-undefined prop at a Paper boundary fails typecheck under this flag.

**Options.** (a) keep the flag and thread conditional spreads through every Paper wrapper,
(b) disable it.

**Decision.** (b) disabled; `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` and
`noFallthroughCasesInSwitch` remain enabled.

**Consequences.** Slightly weaker optional-property safety, in exchange for not littering the UI
layer with spread hacks caused by third-party typings we do not control.

---

## ADR-004 `react-dom` pinned to 19.3.0

**Context.** Removing web support dropped `react-dom`, but `expo-router`'s Radix dependencies
peer-depend on it. npm then resolved `react-dom@19.3.1`, which requires `react@^19.3.1`, conflicting
with the SDK-pinned `react@19.3.0`, and `npm install` failed.

**Decision.** Keep `react-dom@19.3.0` as a dependency (as the official template does) even though we
build no web target.

**Consequences.** Unused JS in `node_modules`; installs are reproducible.

---

## ADR-005 Continuous Native Generation (native folders are git-ignored)

**Context.** The spec defaults to CNG plus a local signing plugin, with an ADR required to commit
`android/` and `ios/` instead.

**Decision.** CNG. `android/` and `ios/` stay in `.gitignore` and are regenerated with
`npx expo prebuild`.

**Consequences.** App configuration lives in `app.json` + config plugins, which is reviewable.
Signing must be supplied at build time from untracked files (see `docs/RELEASE.md`). Release builds
must always start from a clean `prebuild --clean` so local edits cannot silently diverge.

---

## ADR-006 React Native Paper, wrapped

**Context.** Paper 5.15.5 is maintained by Callstack and is pure JS, so New Architecture support is
not a concern.

**Decision.** Use Paper for Material 3 primitives, but wrap every component used by features in
`src/ui/components`. Features never import `react-native-paper` directly (enforced by review and by
`AGENTS.md`).

**Consequences.** Swapping Paper later touches `src/ui` only. Component names carry an `App` prefix
to avoid clashing with React Native's `Text`/`Button`.

---

## ADR-007 No web platform, no server output

**Context.** SDK 58's default template enables web with `"output": "server"`, which contradicts the
"no servers" requirement.

**Decision.** `platforms: ["ios", "android"]` only; no `web` key, no `react-native-web` dependency.

**Consequences.** Web is not testable in a browser. `react-dom` remains as a transitive requirement
(ADR-004) but is unused at runtime.

---

## ADR-008 `android.allowBackup = false`

**Context.** Android auto-backup would copy the SQLite database and attachments to Google Drive —
the opposite of "data stays on this device".

**Decision.** Disable Android auto-backup. Migration between phones is handled by the app's own
export/import (Phase 5).

**Consequences.** Losing or factory-resetting a phone without a manual backup loses the data. The
Home screen shows a gentle in-app backup reminder after 30 days (documented in PRIVACY.md).

---

## ADR-009 Formulary source: RxNorm (Phase 6/7)

**Context.** Drug-name fuzzy matching needs a bundled, permissively licensed medicine list. Indian
brand lists match local prescriptions better but their licences vary.

**Decision.** Start with RxNorm generic names (US NLM, public domain). Revisit an Indian dataset
only after the licence is verified with the user.

**Consequences.** Brand-name prescriptions rely on the fuzzy matcher and manual entry more than with
a local list. Tracked as an open question.

---

## ADR-010 Asian BMI preset by default

**Decision.** Default to Asian thresholds (normal 18.5–22.9, overweight 23–24.9, obese ≥25); WHO
preset selectable. Labels are informational only.

**Consequences.** The user will confirm the preset with a clinician; the setting is user-changeable.

---

## ADR-011 UUIDv7 identifiers generated in `src/lib/ids.ts`

**Decision.** UUIDv7 (time-ordered) generated locally with an injectable RNG; prefers
`crypto.getRandomValues`, falls back to `Math.random`.

**Consequences.** Ids sort chronologically and index well. They are identifiers, not secrets; no
cryptographic guarantee is claimed for the fallback path.

---

## ADR-012 Watchman not installed

**Context.** The original prerequisites list asked for Watchman; Expo's SDK 58 docs state it is only
required for SDK 55 and earlier.

**Decision.** Skip it; Metro's built-in watcher is used.

**Consequences.** If file-watching becomes unreliable, installing it later is purely a performance
improvement.

---

## ADR-013 System font for Phase 0

**Decision.** Use the platform system font until the design pass. Inter will be added with
`expo-font` once the `.ttf` files and their licence are committed (they are not in the repo yet).

**Consequences.** Typography differs slightly between Android and iOS until then; the type scale is
centralised in `src/ui/tokens.ts` so this is a single-file change.

---

## ADR-014 Chips express selection with colour, not an icon

**Context.** Paper draws a checkmark for selected filter chips. Without
`react-native-vector-icons` installed that glyph renders as a tofu box (observed on Android, and
reported on iOS). Pulling in a vector-icon font package for one glyph is not justified.

**Decision.** Set `showSelectedCheck={false}` and express selection with the primary background and
on-primary text. Also removed an invalid `minHeight` from the chip's `textStyle`.

**Consequences.** No icon dependency yet. When icons are genuinely needed (Phase 8 polish), add
`@react-native-vector-icons/material-design-icons` and wire `settings.icon` once.

---

## ADR-015 Native libraries for spikes (e), (f) and (h)

**Context.** The Phase 0 spike list needs PDF rasterisation, on-device OCR and zip.

**Options and decision.**

- **PDF → image:** `react-native-pdf-thumbnail@2.0.0` (Oct 2026, RN ≥0.76). Preferred over
  `react-native-pdf-page-image`, which was last published Sep 2024.
- **OCR:** `expo-ai-kit@0.19.0` (Nov 2026, Expo module, Apple Vision on iOS / ML Kit on Android).
  It exposes `recognizeText()` returning blocks with per-line `confidence`, which HW-3 needs.
  Rejected: `@react-native-ml-kit/text-recognition` (last published Sep 2025).
- **Zip:** `react-native-zip-archive@9.5.3` (Oct 2026). It also exposes `zipWithPassword`, which
  keeps the optional passphrase stretch goal (section 14) open.

**Consequences.** Three native dependencies added; all three verified running on the iOS simulator.
Android verification is still outstanding (physical phone unavailable, no emulator image installed).

**Amendment (Android build).** `expo-ai-kit`'s Vision backend is **opt-in**: the config plugin must be
declared as `["expo-ai-kit", { "vision": true }]`, which writes `expoAiKit.vision=true` into
`android/gradle.properties` and pulls the ML Kit text-recognition dependency into the build. Without
it, `recognizeText()` fails at runtime on Android with
`ModelError: Vision is opt-in ... make a new native build`. iOS linked Apple Vision either way, so this
only bites on Android — the kind of difference a single-platform spike would have missed.

---

## ADR-016 OCR confidence cannot detect handwriting (measured)

**Context.** HW-3 proposed `handwriting.likely = true` when mean OCR confidence falls below 0.6.

**Method.** `expo-ai-kit` on both platforms — Apple Vision (iOS 27.2 simulator) and ML Kit
(Android 16 / API 36 emulator) — over the same 13 real sample images, labelled by the user as
7 handwritten / 6 not handwritten. Metric is the per-image mean of per-line confidence.

**Results — iOS (Apple Vision).**

| Group           | Files | Mean     | Range       |
| --------------- | ----- | -------- | ----------- |
| Handwritten     | 7     | **0.90** | 0.79 – 0.95 |
| Not handwritten | 6     | **0.92** | 0.86 – 0.97 |

**Results — Android (ML Kit).**

| Group           | Files | Mean     | Range       |
| --------------- | ----- | -------- | ----------- |
| Handwritten     | 7     | **0.66** | 0.58 – 0.79 |
| Not handwritten | 6     | **0.77** | 0.72 – 0.82 |

**At the proposed 0.60 threshold.**

| Engine             | Handwritten caught | Printed false positives |
| ------------------ | ------------------ | ----------------------- |
| Apple Vision (iOS) | **0 / 7**          | 0 / 6                   |
| ML Kit (Android)   | **2 / 7 (29%)**    | 0 / 6                   |

**Decision.** Confidence cannot carry HW-3 on either engine, and the same number does not mean the same
thing on each: ML Kit separates by 0.11 and sits ~0.25 lower overall, Apple Vision separates by 0.02.
Therefore:

1. thresholds must be **per engine**, never shared;
2. on iOS, ignore confidence as a document classifier entirely;
3. on Android, confidence may only _add_ evidence;
4. HW-3 relies primarily on the user's "Handwritten" toggle, dictionary-hit rate and line-height
   irregularity, and defaults to **over-warning** when they disagree.

Confidence remains useful as a per-field pre-fill gate, which is a different question from "is this
document handwritten".

**Caveats.** 13 images from one household, one document type each. The engines also disagree on the
text itself — 574 lines (Vision) vs 602 (ML Kit) for the same 13 images — so parser accuracy will need
per-platform measurement too.

**Consequences.** Phase 7's acceptance test is "every handwritten sample shows the strong banner",
not "mean confidence below X". This table is the baseline that Phase 7 must beat or justify.

---

## ADR-017 Dates: ISO in storage, DD/MM/YYYY on screen

**Context.** Dates without time are stored as `YYYY-MM-DD`, which sorts correctly and avoids timezone
drift. The owner wants every date the user sees rendered as `DD/MM/YYYY`, consistent across Android
and iOS.

**Options.** (a) render with `toLocaleDateString` and let the device locale decide; (b) format the
stored string directly.

**Decision.** (b). `formatDisplayDate()` in `src/lib/dates.ts` slices the stored `YYYY-MM-DD` and
returns `DD/MM/YYYY`, zero-padded. No `Date` object, no locale dependency. The `locale` parameter was
removed so no caller can accidentally reintroduce locale-dependent output. Invalid input is returned
unchanged so a bad value is visible rather than silently blanked.

**Consequences.**

- Storage format is unchanged; migrations and sorting are unaffected.
- 24-hour vs 12-hour times are a separate question and not covered here.
- Month section headers on the Records timeline remain textual labels ("November 2026"), not dates.
- The native date picker still shows the OS's own format while open; the chosen value is echoed beneath
  it as `DD/MM/YYYY`.
- Phase 4's PDF export must use the same helper so the printed output matches the app.

---

## ADR-018 Forward-only SQL migrations driven by `PRAGMA user_version`

**Context.** Phase 1 introduces the first real schema. Migrations must run on first launch, must be
reviewable in the pull request, and must be testable from every prior version. `drizzle-kit` is not a
dependency, and its generated `migrations.js` bundle hides the SQL that actually runs.

**Options.** (a) `drizzle-kit generate` + `drizzle-orm/expo-sqlite/migrator`; (b) ordered migration
modules containing plain SQL, applied by a small runner that tracks `PRAGMA user_version`.

**Decision.** (b). `src/data/migrations.ts` holds an immutable ordered list of
`{ version, name, statements }`; `src/data/migrate.ts` applies every migration above the current
`user_version`, each one inside a single transaction that also sets `user_version = N`. There are no
down-migrations — a released version only ever moves forward.

**Consequences.**

- The SQL in the repository is exactly the SQL that runs on the device, so it can be reviewed and
  tested directly.
- `src/data/schema.ts` and the SQL are maintained by hand; a **schema-drift test** compares the
  migrated database (`PRAGMA table_info` / `index_list` / `foreign_key_list`) against the Drizzle
  definitions, so the two cannot silently diverge.
- Every migration is tested from every prior version, which makes a future v2 covered automatically by
  the existing loop rather than by a new bespoke test.
- Adding `drizzle-kit` later stays possible: it can generate SQL that is copied into a new migration
  module, without adopting its migrator.

---

## ADR-019 Repository tests run on real SQLite via Node's built-in `node:sqlite`

**Context.** Repository behaviour (constraints, cascades, transactions) must be tested, not mocked.
Jest cannot load the native `expo-sqlite` module, and Drizzle's expo driver talks to a synchronous
client surface (`prepareSync` → `executeSync` / `executeForRawResultSync`).

**Options.** (a) `better-sqlite3` dev dependency + Drizzle's `better-sqlite3` dialect; (b) a
`node:sqlite`-backed shim implementing the expo-sqlite client surface, keeping the **same** Drizzle
dialect as the app; (c) mocking Drizzle itself.

**Decision.** (b). `src/data/testing/testDatabase.ts` opens `new DatabaseSync(':memory:')` and exposes
`prepareSync`, which is the only client method the expo driver uses. Tests therefore exercise the real
session, the real transaction handling and the real SQL, with **no new dependency** and no second
dialect to keep in sync. Verified before implementing: real Drizzle queries, `ON DELETE CASCADE`,
`PRAGMA user_version` and rollback all behaved correctly through the shim.

**Consequences.**

- `node:sqlite` is still marked experimental in Node 24 (it prints a warning and its API may change).
  The risk is confined to one adapter file; swapping its internals for `better-sqlite3` would not touch
  a single repository.
- Tests declare `@jest-environment node` and stub `expo-sqlite`, because
  `drizzle-orm/expo-sqlite/index.js` re-exports a live-query hook that imports the native module at
  runtime.
- This is a **test-only** dependency on a Node built-in: nothing in the app bundle changes, and the app
  still ships only `expo-sqlite`.

---

## ADR-020 Repositories are synchronous, and transactions take synchronous callbacks

**Context.** Drizzle's expo-sqlite session is synchronous: it prepares with `prepareSync`, executes with
`executeSync`, and brackets a callback with `begin`/`commit`/`rollback` **without awaiting it**.

**Options.** (a) wrap every repository call in `Promise.resolve()` for a future async driver; (b) expose
the synchronous API the driver actually has.

**Decision.** (b). Repository functions are synchronous and return `Result<T, AppError>`; every write
uses `db.transaction((tx) => { … })` with a **synchronous** callback.

**Consequences.**

- A measured trap, not a theoretical one: an `async` transaction callback commits before its `throw`, so
  the rollback never happens (observed during the Phase 1 probe: the "rolled back" row was still
  present). Repository write paths are sync by design and a rollback test guards it.
- Async work (file I/O in Phase 2, zip in Phase 5) stays outside repositories, in `fileStore`/platform
  code, which is where it already belongs.
- TanStack Query accepts synchronous `queryFn`/`mutationFn` results, so features are unaffected.
- Long DB work runs on the JS thread. At one family's data volume this is milliseconds; it is revisited
  only if a measurement shows otherwise.

---

## ADR-021 `@react-native-community/datetimepicker` for date entry

**Context.** The record form needs a date picker. Phase 1 has no way to enter a date without either a
native picker or a hand-built text field, and the phase spec requires a native picker with the chosen
value echoed as `DD/MM/YYYY` (ADR-017).

**Options.** (a) `@react-native-community/datetimepicker`; (b) a hand-rolled calendar; (c) a plain text
field parsing `DD/MM/YYYY`.

**Decision.** (a), at the version Expo pins for this SDK (`9.2.1` in `bundledNativeModules.json`), so the
native side matches the platform toolchain. It requests no permissions, makes no network calls and adds
no camera capability.

**Consequences.**

- One native rebuild per platform (prebuild + `pod install` / Gradle), which Continuous Native Generation
  already makes routine (ADR-005).
- The OS picker renders its own locale while open; the field beneath it always echoes `DD/MM/YYYY`, which
  is the value the user is agreeing to.
- If a future SDK drops it, the fallback is (c): a validated `DD/MM/YYYY` text field.

---

## ADR-022 Settings and the record draft live in `app_setting`

**Context.** Phase 1 needs persistent preferences (units, BMI preset, active person, onboarding state)
and a record draft that survives the app being killed. No key-value storage dependency is installed.

**Options.** (a) add `@react-native-async-storage/async-storage`; (b) store both in the existing
`app_setting` table behind the settings repository.

**Decision.** (b). Values are JSON-encoded TEXT under stable keys (`settings.units`, `settings.bmiPreset`,
`settings.activePersonId`, `settings.onboardedAt`, `draft.record`), read through one typed accessor that
applies defaults and Zod validation.

**Consequences.**

- One storage mechanism, one backup path (Phase 5 exports the database anyway), and no new dependency.
- Draft writes are debounced (~400 ms) and the payload is capped at 64 KB so a runaway form cannot bloat
  the database; the draft is cleared on save or explicit discard.
- Backups therefore include the draft. That is acceptable for a single-family device and is simpler than
  a separate file.
