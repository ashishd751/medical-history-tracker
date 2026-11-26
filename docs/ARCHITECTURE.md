# Architecture

## Shape

```
app/                 Expo Router routes (thin: wire a screen to a feature)
src/features/*       UI + hooks + schemas + services per feature
src/domain/          Pure TypeScript rules. No React, no Expo, no I/O.
src/data/            Drizzle schema, migrations, repositories, fileStore
src/platform/        Device capabilities behind interfaces (picker, OCR, print, zip, …)
src/ui/              Design tokens, theme, wrapped Paper components
src/lib/             Result, errors, logging, ids, dates
```

Dependency direction (enforced by `npm run deps:check`):

```
app -> features -> domain <- data
             \-> ui          <- platform -> domain (types only)
```

Rules:

| Layer      | May import                                                                |
| ---------- | ------------------------------------------------------------------------- |
| `domain`   | nothing outside `domain`                                                  |
| `data`     | `domain`, Drizzle, expo-sqlite, expo-file-system                          |
| `platform` | `domain` types only                                                       |
| `features` | `domain`, `data`, `platform`, `ui`, `lib` (not other features' internals) |
| `ui`       | `lib`, `@/ui` internals — never `features`, `data`, `platform`            |
| `app`      | anything, but only for wiring                                             |

## Why these boundaries

- `domain` is where all medical logic lives (BMI, BP categories, profile sync, parsers, formulary
  matching). Keeping it pure means it is unit-testable without a device and cannot accidentally
  depend on a screen.
- `data` is the only place SQL exists. Repositories own transactions; nothing else touches Drizzle.
- `platform` wraps every native capability in an interface so tests can fake it, and so a library
  swap (OCR engine, PDF renderer) is a one-file change.
- `ui` wraps Paper so the design system can be replaced without touching features.

## State

- **TanStack Query** for reads over repositories (caching, invalidation after writes).
- **Zustand** for drafts, filters and UI flags.
- **react-hook-form + Zod** for forms; Zod also validates import files, OCR output and settings.

## Data invariants

- Ids are UUIDv7 strings.
- Dates without time are `YYYY-MM-DD` in storage (device-local calendar) and **`DD/MM/YYYY` in every
  user-facing surface** — cards, timelines, detail rows, form summaries, PDF export. Formatting lives
  in `formatDisplayDate()` and is string-based, so it does not vary with device locale.
- Timestamps are UTC epoch milliseconds.
- Measurements are stored in metric; converted only for display.
- BMI is never stored — always computed from the latest height and weight.
- Attachments store **relative** paths; the FileStore resolves them.
- Profile values are derived from `measurement` rows, so editing a record simply recomputes.

## Data core (Phase 1)

```
src/data/schema.ts          Drizzle table definitions + inferred row types
src/data/migrations.ts      ordered, forward-only SQL migration modules
src/data/migrate.ts         applies migrations above PRAGMA user_version
src/data/db.ts              the one app connection: WAL, foreign_keys, migrate
src/data/repositories/*     the only code that touches Drizzle; sync + Result
src/data/testing/*          node:sqlite harness used by tests only
```

- Writes go through `db.transaction((tx) => …)` with a **synchronous** callback (ADR-020).
- Repositories take the database instance as an argument (`createRecordRepository(db)`), so tests build
  one over an in-memory database and production builds one over `expo-sqlite`.
- Every query is person-scoped; `personId` is a required first argument, never inferred from state.
- Deleting a record cascades to its medications, readings and attachments (foreign keys are on for
  every connection, not just the migration connection).
- Search is an FTS5 trigram index (`record_fts`, migration v2) over the record's searchable text,
  external-content over `record` and maintained by triggers. Three or more characters use the index;
  shorter needles fall back to `instr` (ADR-023). `rebuildSearchIndex(db)` rebuilds it. **Never run
  `VACUUM`** — it can renumber `record.rowid` and desynchronise the index.
- The timeline reads through `listPage(personId, filter, limit, offset)` (`limit + 1` for `hasMore`) and
  counts through `count(personId, filter)`; both share one filter predicate (ADR-024).

## UI system

- `src/ui/tokens.ts` owns colour, spacing, radius and the type scale. Features never hard-code a size;
  the bottom tab label uses the `tabLabel` token (ADR-027).
- `AppChoiceGrid` is the control for exclusive and multi-select choices: equal-width pills, colour-only
  selection, keyboard dismissal (ADR-025). `AppChip` is for free-standing tags and inline actions.
- `AppFactGrid` renders label-over-value tiles in one to three columns. Profile uses it for the six
  person facts and, one-column, for long free text.
- `AppScreen` pads the bottom safe area only when a screen passes `safeAreaBottom` (pinned footers on
  routes outside the tabs). Tab screens must not pass it (ADR-026).

## Testing

| Layer               | Tool                                                    |
| ------------------- | ------------------------------------------------------- |
| `domain`, `lib`     | Jest unit tests (~100% target)                          |
| `data` repositories | Jest against a real in-memory SQLite database (ADR-019) |
| Components          | React Native Testing Library                            |
| End-to-end          | Maestro flows in `.maestro/`                            |

React Native Testing Library v14 renders asynchronously: `render`, `fireEvent`, `rerender` and
`renderHook` all return promises, so component tests must `await` them. `npm run bench:search` is a
separate Node script (not a Jest test) because timing assertions would be flaky on CI.
