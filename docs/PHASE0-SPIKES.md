# Phase 0 spike results

Ran on 25 Nov 2026. "iOS" = iPhone 18 Pro simulator, iOS 27.2 (Apple Vision).
"Android" = `mht_play` AVD (Pixel 10 profile), Android 16 / API 36, arm64, `google_apis_playstore` (ML Kit).

| #   | Spike                            | iOS | Android | Notes                                                                                                                  |
| --- | -------------------------------- | --- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| a   | Paper renders / design system    | ✅  | ✅      | iOS light + Android dark captured; chips assert navigable                                                              |
| b   | `expo-sqlite`                    | ✅  | ✅      | `rows=2 last="world" id=2` on both                                                                                     |
| c   | `expo-file-system` new API       | ✅  | ✅      | `read="medical-history-spike" size=21B`, delete confirmed                                                              |
| d   | Library picker + document picker | ✅  | ✅      | iOS: "Private Access to Photos"; Android: "will only have access to the photos you select". No camera prompt on either |
| e   | PDF → image                      | ✅  | ✅      | iOS `596x842 jpeg=87520B`; Android `595x842 jpeg=59383B`                                                               |
| f   | OCR (13 labelled samples)        | ✅  | ✅      | iOS 574 lines mean 0.92; Android 602 lines mean 0.74                                                                   |
| g   | `expo-print` HTML → PDF          | ✅  | ✅      | 1 page, 28640 B (iOS) / 16491 B (Android)                                                                              |
| h   | zip / unzip                      | ✅  | ✅      | 15↔15 files 48.4 MB (iOS); 16↔16 48.5 MB (Android)                                                                     |
| i   | Formulary licence                | ✅  | —       | RxNorm, public domain (ADR-009)                                                                                        |

## OCR confidence by label

| Group           | Files | iOS (Vision)     | Android (ML Kit) |
| --------------- | ----- | ---------------- | ---------------- |
| Handwritten     | 7     | 0.90 (0.79–0.95) | 0.66 (0.58–0.79) |
| Not handwritten | 6     | 0.92 (0.86–0.97) | 0.77 (0.72–0.82) |

At a 0.60 threshold: iOS catches **0 of 7** handwritten pages; Android catches **2 of 7**, with 0 of 6
false positives. Confidence separates handwriting poorly on iOS and weakly on Android, and thresholds
do **not** transfer between engines (ADR-016). The two engines also disagree on the text itself —
574 vs 602 lines for the same 13 images — so parser accuracy will differ per platform too.

Labels live in `private-samples/LABELS.md` (git-ignored, never committed).

## Android OCR: how it was unblocked

The `google_apis` image could not install the ML Kit model (_"Google Play services could not install
the on-device vision model"_). Switching to a `google_apis_playstore` image fixed it with **no code
change** — the model is fetched through Play services at runtime.

Two prerequisites were genuine code/config issues, both fixed:

1. `["expo-ai-kit", { "vision": true }]` in `app.json` (writes `expoAiKit.vision=true` for Android).
   Without it: _ModelError: Vision is opt-in_. iOS linked Apple Vision regardless.
2. `prepareVision({ features: ['text-recognition'] })` before the first `recognizeText()` call.
   Without it: _ModelError: the on-device text recognition model is not installed yet_.

Phase 6 must therefore treat "prepare the model" as a real first-run state with a progress indicator,
not an invisible implementation detail.

## Environment gotchas found

- `expo-ai-kit` needs `["expo-ai-kit", { "vision": true }]`; without it Android fails at runtime while
  iOS works (ADR-015 amendment).
- Always create AVDs with a device profile (`--device pixel_10`). The first attempt had none and was
  320×640 px — useless for judging layout.
- Maestro needs `--device <udid>` once more than one device is connected.
