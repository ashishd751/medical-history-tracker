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

---

## ADR-016 OCR confidence is not a reliable handwriting signal (evidence)

**Context.** HW-3 proposed `handwriting.likely = true` when mean OCR confidence falls below 0.6.

**Evidence (iOS simulator, iPhone 18 Pro, 13 real sample images, Apple Vision via expo-ai-kit):**
574 recognised lines, **mean confidence 0.92**, and **zero** images below 0.60 — including samples
that are handwritten prescriptions.

**Decision.** Treat the 0.6 confidence threshold as **insufficient on its own**. Phase 7 must combine
it with the other two signals from HW-3 (share of tokens present in the analyte/formulary/word lists,
and line-height irregularity), and be validated per-platform: Apple Vision and ML Kit report
confidence on different scales, so a single global threshold is not portable.

**Consequences.** The handwriting banner must not depend on confidence alone; when in doubt the app
should over-warn rather than under-warn. Thresholds are recorded here with the sample count so the
Phase 7 numbers can be compared honestly.
