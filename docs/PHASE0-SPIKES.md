# Phase 0 spike results

Ran on 25 Nov 2026. "iOS" = iPhone 18 Pro simulator, iOS 27.2 (Apple Vision).
"Android" = `mht_api36` AVD, Android 16 / API 36, arm64 (ML Kit).

| #   | Spike                            | iOS | Android    | Notes                                                                                              |
| --- | -------------------------------- | --- | ---------- | -------------------------------------------------------------------------------------------------- |
| a   | Paper renders / design system    | ✅  | ✅         | iOS light + Android dark captured; chips assert navigable                                          |
| b   | `expo-sqlite`                    | ✅  | ✅         | `rows=2 last="world" id=2` on both                                                                 |
| c   | `expo-file-system` new API       | ✅  | ✅         | `read="medical-history-spike" size=21B`, delete confirmed                                          |
| d   | Library picker + document picker | ✅  | not run    | iOS: **"Private Access to Photos"** — no photo or camera permission                                |
| e   | PDF → image                      | ✅  | ✅         | iOS `596x842 jpeg=87520B`; Android `595x842 jpeg=59383B`                                           |
| f   | OCR (13 labelled samples)        | ✅  | ⚠️ blocked | iOS: 574 lines, mean 0.92. Android: Play services cannot install the ML Kit model on this emulator |
| g   | `expo-print` HTML → PDF          | ✅  | ✅         | 1 page, 28640 B (iOS) / 16491 B (Android)                                                          |
| h   | zip / unzip                      | ✅  | ✅         | 15↔15 files 48.4 MB (iOS); 16↔16 48.5 MB (Android)                                                 |
| i   | Formulary licence                | ✅  | —          | RxNorm, public domain (ADR-009)                                                                    |

## OCR confidence by label (iOS, Apple Vision)

| Group           | Files | Mean | Range       |
| --------------- | ----- | ---- | ----------- |
| Handwritten     | 7     | 0.90 | 0.79 – 0.95 |
| Not handwritten | 6     | 0.92 | 0.86 – 0.97 |

Confidence does not separate handwriting (ADR-016). Labels live in `private-samples/LABELS.md`
(git-ignored, never committed).

## Android OCR blocker

`prepareVision()` fails with _"Google Play services could not install the on-device vision model"_ on
the `google_apis` emulator image, because it has no working Play Store. Two ways to close it:

1. create an AVD from a `google_apis_playstore` system image (Play Store can fetch the model), or
2. run the spike on the physical OnePlus.

Neither the app code nor the ML Kit integration is proven wrong — the model simply could not be
fetched in this environment.

## Environment gotchas found

- `expo-ai-kit` needs `["expo-ai-kit", { "vision": true }]`; without it Android fails at runtime while
  iOS works (ADR-015 amendment).
- The `mht_api36` AVD was created without a device profile and is 320×640 px — fine for functional
  checks, wrong for visual parity. Recreate with `--device pixel_7` before judging layout.
- Maestro needs `--device <udid>` once more than one device is connected.
