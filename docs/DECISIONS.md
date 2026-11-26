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
- Loading `@types/node` project-wide (tsconfig `types`) is the price of typing that harness, so an
  ESLint `no-restricted-globals` rule bans `process`, `Buffer`, `require` and friends in `src/` and
  `app/` — device code cannot quietly start using APIs the React Native runtime does not have.

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

---

## ADR-023 Full-text search over records uses FTS5 with the trigram tokenizer

**Context.** The timeline searches title, condition, symptoms, facility, prescription text, comments and
the doctor's name. Symptoms are the field people actually search ("headache", "cough"), and they are
stored as a JSON array in one TEXT column. The pre-FTS predicate was six `instr(lower(column), ?)` tests
plus a doctor subquery, so every query was a full scan whose cost grew with the number of records.
Phase 1 closed with an open question: if symptom search feels slow over years of data, normalise
symptoms into their own table (migration v2). The answer was to make it fast if volume demanded it.

**Options.** (a) a normalised `record_symptom` table with joins; (b) an FTS5 index over the searchable
columns, external-content over `record`; (c) keep `instr` and add indexes; (d) FTS5 with the default
`unicode61` tokenizer.

**Decision.** (b), with `tokenize='trigram'`, added as migration v2:

- `record_fts` is an external-content FTS5 table over `title, condition, symptoms, facility,
prescription_text, comments`, keyed by `record.rowid`. Migration v2 backfills it, and `AFTER
INSERT/DELETE/UPDATE` triggers keep it in step — including rows removed by the person-delete cascade
  (a test proves the delete trigger fires).
- Needles of three or more characters become one quoted FTS phrase (`"ache"`), so punctuation and
  `AND`/`OR`/`*` cannot turn the search box into query syntax. Fewer than three characters fall back to
  `instr`, because trigram cannot match a shorter string; in that branch symptoms are walked with
  `json_each` instead of scanning the raw JSON, so searching `"` no longer matches every record that has
  any symptom.
- A doctor's name is matched through a subquery over `doctor`, not copied into the index: the table is
  tiny, and renaming a doctor must not require re-indexing every record.
- The FTS branch is written as `record.rowid IN (SELECT rowid FROM record_fts WHERE record_fts MATCH ?)`
  and the caller's `WHERE` already scopes the person. This shape matters: joining `record` inside the
  subquery let SQLite drive from the person index and probe the FTS table once per row — **440 ms** for
  a rare term over 10,000 records on the benchmark data, against **0.33 ms** in the shape above.
- `rebuildSearchIndex(db)` runs FTS5's `rebuild` command. It exists because the index is keyed by
  `rowid`: `VACUUM` may renumber rowids and silently desynchronise it. **The app must never run
  `VACUUM`.** Phase 5's backup import must call `rebuildSearchIndex` after a bulk write that bypasses
  triggers.

**Why trigram.** Symptom search is substring search: a person typing `ache` expects `headache`, and
`coug` expects `cough`. `unicode61` only matches token prefixes, so it would need a normalised table of
whole words and would still miss mid-word input. Trigram also makes the JSON array's own punctuation
harmless for 3+ character queries, because a phrase like `"***"` matches no word trigrams.

**Benchmark** (`npm run bench:search`; Apple M4 Pro, macOS, Node 24.14.0, SQLite 3.51.2, 20,000 synthetic
records — 10,000 per person — 15.3 MiB, 21 timed runs after 3 warm-ups):

| scenario                        | instr median | instr p95 | FTS median | FTS p95 | FTS speed-up |
| ------------------------------- | -----------: | --------: | ---------: | ------: | -----------: |
| common `ache` · page (LIMIT 25) |      0.12 ms |   0.13 ms |    1.04 ms | 1.16 ms |         0.1× |
| rare `sarcoidosis` · page       |      8.01 ms |   8.53 ms |    0.33 ms | 0.42 ms |          24× |
| common `ache` · count           |      5.95 ms |   6.78 ms |    1.74 ms | 1.81 ms |         3.4× |
| rare `sarcoidosis` · count      |      7.63 ms |   7.95 ms |    0.27 ms | 0.30 ms |          28× |

Both sides return the same rows. The common page case is the one where the old scan wins: the
`(person_id, date)` index delivers rows in display order, so an `instr` scan can stop after 25 matches.
FTS has to collect every match in the index and sort it before applying the limit, so it pays ~1 ms for
4,262 matches. Even there the absolute cost is negligible; the cases that scale badly for `instr` —
rare terms and **counts**, which cannot stop early — are 3–28× faster, and FTS cost depends on the
number of matches rather than the size of the table. That is the property that matters as the family's
history grows, and the header count (ADR-024) runs on every filter change.

**Answers to the open question.** Yes: symptom search is now indexed with FTS5. No normalised symptom
table is needed for Phase 1; if a future feature needs per-symptom aggregation (for example "how often
did this symptom recur"), a table is still the right shape for that query, and the version-matrix test
already supports adding migration v3.

**Consequences.**

- The index costs disk and write time: every insert/update writes six columns into `record_fts` through
  a trigger. Records are written at human speed, so this is not measurable in practice.
- Trigram needs SQLite 3.34+; `expo-sqlite` in SDK 58 bundles 3.53.3 with FTS5 compiled in on both
  platforms, and the Node test harness (3.51.2) runs the same SQL.
- The index is derived data. Anything that bulk-rewrites `record` without firing triggers must call
  `rebuildSearchIndex()`; anything that renumbers rowids (i.e. `VACUUM`) is forbidden.
- The index contains the raw symptom JSON; the `<3`-character fallback no longer does. A 3+ character
  query for JSON punctuation is a curiosity, not a supported search, and returns nothing.
- Search is person-scoped in SQL, not in the index, so one family member's records can never appear in
  another's results (tested).

---

## ADR-024 The Records timeline pages 25 rows at a time; counts are a separate query

**Context.** Phase 1 closed with an open question: should the Records timeline be a virtualised list with
pagination, or is a capped history acceptable for this family's volume? Reviewing the app made the
answer explicit — there may be a lot of records over time, so paginating is the better choice. The
timeline also needs a truthful header ("42 records"), not the number of rows currently loaded.

**Options.** (a) `FlatList` over a capped in-memory list (the Phase 1 behaviour: 500, then 50); (b) keyset
pagination on `(date, created_at, id)`; (c) offset pagination with `limit + 1`; (d) a virtualised list
that loads everything in one query.

**Decision.** (c), implemented in `recordRepository.listPage(personId, filter, limit, offset)`:

- The query fetches `limit + 1` rows and returns `{ items, hasMore }`. One extra row answers "is there a
  next page?" without a second `COUNT` on every scroll.
- `RecordsScreen` uses `useInfiniteQuery` with `PAGE_SIZE = 25`, `initialPageParam: 0`, and
  `onEndReached` (threshold 0.5), so a 60-row history is three requests and the UI never holds more rows
  than the user has scrolled through.
- `buildTimeline(rows)` flattens every loaded page into month headers plus records. A month that straddles
  a page boundary produces one header, not two.
- `listSummaries` keeps a safety cap of `DEFAULT_PAGE_LIMIT = 50` for callers that genuinely want a short
  list (Home's four recent records, tests).
- The header total comes from `count(personId, filter?)`, which shares `filterConditions` with the list —
  the same date range, kinds, FTS-aware search and person scope. The screen keeps the previous number
  while the next one loads instead of flickering.
- Offset, not keyset: a page is 25 rows, ordering is stable (`date DESC, created_at DESC, id DESC`), and
  this is a single-user offline app. Keyset would need a composite cursor and would complicate the
  filter/skip logic for a gain that only matters if rows are inserted while the user pages. New records
  appear at the top on the next refresh, which is what a person expects after saving.

**Answers to the open question.** Yes: pagination is implemented now, in Phase 1. **Phase 8 no longer
needs it**; its release work is the table view, accessibility and error/empty states.

**Consequences.**

- `count()` runs on every filter change (including each settled search keystroke, after the 250 ms
  debounce in ADR-027). The benchmark in ADR-023 measures it: 1.74 ms FTS for a common term over 20,000
  records, versus 5.95 ms for the old scan.
- The count is a separate request from the page, so a slow count cannot block the first rows; the header
  may show the previous total for a moment after a filter change.
- Adding a filter means adding it to `filterConditions` only, and both the list and the count stay
  consistent. A test creates 30 matches, loads 25, and asserts the total is 30.
- Maestro's `1 record` / `0 records` assertions remain valid because the header string is unchanged.
- Any future export (Phase 4) must page through the repository rather than call `listSummaries()` with no
  limit; the 50-row cap is deliberate.

---

## ADR-025 `AppChoiceGrid` replaces Paper's `Chip` for exclusive choices

**Context.** Paper's `Chip` sizes itself to its label. Once a screen has six or eight options the pills
end at ragged, uneven widths and leave most of a row empty — the Phase 1 review described the record
form's chips as "cluttered, not using the full horizontal space". The review also asked for the same
treatment on onboarding, Settings, the Records filter sheets and the Profile edit sheet.

**Options.** (a) keep `Chip` with manual widths; (b) style Paper `Chip` through `style` overrides; (c) a
project-owned grid of equal-width pressable pills in `src/ui`.

**Decision.** (c): `src/ui/components/AppChoiceGrid.tsx`.

- `columns` is 1–4; every cell is `100 / columns` percent wide, so rows line up with the screen gutters
  and the last row does not stretch.
- Selection is shown by colour only (filled primary background, `onPrimary` text) — there is no icon
  font, so no check glyph (ADR-014). `accessibilityState.selected` carries the state for screen readers.
- It is single- or multi-select without owning the toggle rule: it reports the pressed value and the
  caller decides (the Records type filter appends/removes, the record form replaces).
- Pressing an option dismisses the keyboard first. This is both expected behaviour and the reliable way
  to dismiss it on Android in the Maestro flow.
- `testIDPrefix` keeps the existing ids (`${prefix}-${value}`), so Maestro selectors did not change.
- Used by: record form (kind, 3 columns), onboarding (sex 2, units 2, blood type 4), Settings (units 2,
  BMI preset 2), the Records filter sheets, and the Profile edit sheet (blood type, 4 columns).

**Consequences.**

- Option labels must be short: each label is `numberOfLines={1}` and will ellipsise rather than push the
  row. Every current label fits ("Female", "Imperial (ft, lb)" at two columns).
- `AppChip` stays for non-exclusive content and inline actions: the Home person switcher, medication
  tags, and the Records filter buttons that open a sheet.
- The grid is pure `ui`; it imports no repository, feature or Paper internals, so a design-system change
  stays in one file.

---

## ADR-026 Only pinned-footer screens pad the bottom safe area

**Context.** The interim fix made `AppScreen` add `insets.bottom` whenever `scroll={false}`, to stop the
record form's Save button from sitting under the home indicator. But Records is also `scroll={false}`
(it is a `FlatList`), and it lives inside the tab navigator, whose bar already clears the home indicator.
Records therefore gained a double gap at the bottom — the regression in R3.

**Options.** (a) keep the inset for every non-scrolling screen and special-case the tab screens; (b) make
the inset an explicit opt-in prop; (c) drop the inset and let footers use their own padding.

**Decision.** (b): `AppScreen` has `safeAreaBottom?: boolean`, **default false**. The root pads
`insets.bottom` only when `safeAreaBottom && !scroll`. Scrollable content keeps its own
`insets.bottom + spacing.xxl` padding inside the scroll area, where it cannot create a visible gap.

Only two screens opt in today: `RecordFormScreen` and `OnboardingScreen` — both full-screen routes
outside the tab navigator with a button pinned to the bottom. Records, Home, Profile and Settings do not.

Opt-in screens also wrap their body in a `KeyboardAvoidingView` (`behavior="padding"`), so a pinned
footer clears the **software keyboard**, not just the home indicator. Device QA found Save completely
hidden behind the Android keyboard: with edge-to-edge the window no longer resizes, so the footer has
to be lifted explicitly.

**Consequences.**

- A new full-screen route with a pinned footer must set `safeAreaBottom`; forgetting it puts the footer
  under the gesture bar, which is visible immediately on QA.
- A tab screen must never set it. `AppScreen.test.tsx` asserts default 0, the opt-in value at 34 pt, and
  that the opt-in is ignored while scrolling.
- The same test asserts the keyboard-avoiding wrapper exists only for opt-in screens, so a future
  `safeAreaBottom` screen cannot silently lose it.
- The rule is structural rather than a per-screen height guess, so devices with no home indicator
  (inset 0) need no special case.

---

## ADR-027 Records filter UX, search debounce, tab label and Profile layout

**Context.** The post-Phase-1 review found four UX problems: the tab labels were small; the Records page
spent half the screen on filters; the Profile card used only its left half; and the record form's chips
were cluttered while the fixed Save button was partly cut off. The interim commit addressed most of the
first three; this ADR records the rules so later screens stay consistent.

**Decision.**

- **Records filters** live in the `FlatList` header, not above it: a search field, two chips that open
  bottom sheets ("Type: …", "Period: …"), a "Clear filters" chip when anything is active, and a count.
  Everything scrolls away as soon as the user reads the list, because the list is the point. Filtering is
  multi-select for kind and single-select for period presets computed on the device's local calendar.
  The count is the true total from `count()` (ADR-024), not the loaded rows.
- **Search is debounced by 250 ms** (`useDebouncedValue`) before it becomes a query. Clearing the box
  applies immediately, so "Clear filters" never feels stuck. The debounce reduces both the page query and
  the count query to one per pause in typing, and stops paging from resetting on every keystroke.
- **Tab labels** use `typography.tabLabel` (15/20) instead of a hard-coded size, are `numberOfLines={1}`,
  and cap OS font scaling at `maxFontSizeMultiplier={1.2}`. Five even slots on a 360 dp phone leave
  ~72 dp each; without the cap, Android's largest font scale ellipsised "Settings".
- **Profile** uses `AppFactGrid` from `src/ui`: a two-column grid of fact tiles (label in `caption`/
  muted above, value in `subtitle` below) for Date of birth | Sex, Blood type | BMI (+ category badge),
  Height | Weight, with a hairline divider and two full-width rows for Allergies and Chronic conditions.
  The same grid is used one-column for long text and is the same visual language as the Home snapshot.
  At OS font scales of 1.5 or more it collapses to one column (`useWindowDimensions().fontScale`),
  because two columns wrapped a `DD/MM/YYYY` date mid-string on the iOS simulator at accessibility XL.
  The edit sheet uses `AppChoiceGrid` for blood type (ADR-025).

**Consequences.**

- The filters are reachable only by scrolling to the top of the list; that is the deliberate trade-off
  for giving the list the screen. The search field is still the first thing at the top of the list.
- The grid is width-driven (`100 / columns` percent), so a tablet simply gets wider tiles; no breakpoints
  or device classes are involved, and light/dark themes come from tokens.
- `AppFactGrid` keys tiles by label, so labels must be unique within one grid. Values stay strings; a
  badge or other accessory is passed as `accessory`.
- Capping tab-label scaling is a small accessibility trade-off (labels scale to 120%, not 200%). The
  alternative — truncating "Settings" — hides the destination entirely, and the tab has an
  `accessibilityLabel` and `accessibilityRole="tab"` for assistive technology. Verified on the Android
  emulator at 360 dp and 1.3× font: all four labels stay on one line in five even slots.
- The Profile test asserts the tile ids, the DD/MM/YYYY date, metric units, the BMI value and the
  four-column blood-type grid, so a layout regression fails CI even though CI cannot see pixels.
