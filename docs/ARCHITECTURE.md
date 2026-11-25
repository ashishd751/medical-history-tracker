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

## Testing

| Layer               | Tool                                                      |
| ------------------- | --------------------------------------------------------- |
| `domain`, `lib`     | Jest unit tests (~100% target)                            |
| `data` repositories | Jest against a temp SQLite database, including migrations |
| Components          | React Native Testing Library                              |
| End-to-end          | Maestro flows in `.maestro/`                              |
