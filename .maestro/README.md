# Maestro end-to-end flows

Flows run against an installed **development build** with Metro already serving the project. Start
Metro first (`npx expo start --dev-client --port 8081`) and leave it running.

## Running a flow

Both devices can be attached, so `--device` is required. The Metro URL is passed in, because the iOS
simulator and the Android emulator reach the host differently:

```bash
# iOS simulator
maestro --device D65428AF-F679-40FB-817B-FCC564B975C6 test \
  --env EXPO_URL='medicalhistory://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081' \
  --env METRO_HOST='localhost:8081' \
  .maestro/records/create-manual.yaml

# Android emulator — 10.0.2.2 is the emulator's alias for the host loopback
maestro --device emulator-5554 test \
  --env EXPO_URL='medicalhistory://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081' \
  --env METRO_HOST='10.0.2.2:8081' \
  .maestro/records/create-manual.yaml
```

## What the flow covers

`records/create-manual.yaml` starts from a cleared app state (`clearState: true`) and proves the
Phase 1 acceptance path:

1. onboarding (name, date of birth, sex, height, weight) writes the person and settings rows;
2. Home shows the derived BMI (24.2 for 70 kg at 170 cm) and the snapshot card;
3. the centre "+" opens the add sheet, "Fill in manually" opens the record form;
4. saving opens the new record's detail screen;
5. detail and timeline both render the date as `DD/MM/YYYY` and **never** as `YYYY-MM-DD`.

The remaining form fields (doctor, facility, condition, repeaters, vitals) are covered by the
repository tests rather than the flow, to keep the end-to-end path stable on both platforms.

## Things that make a flow flaky here

- **The dev client's own screens.** A fresh install shows a launcher, then a one-time "Continue"
  intro, and on Android an in-app dev menu. Each dismissal is wrapped in a `runFlow: when:` block so
  it only runs when that screen is actually present.
- **Cold-start taps.** A tap that lands while the dev client's overlay is still fading out is
  swallowed, which looks exactly like "the text field ignores input". The flow waits for animations
  and taps the field twice.
- **Keyboard dismissal differs by platform.** `hideKeyboard` fails on iOS when the simulator has no
  software keyboard, and on Android it sends BACK — which navigates when no keyboard is up. The flow
  uses `hideKeyboard` on Android only and a tap on a static heading on iOS.
- **The footer moves while the keyboard hides.** Tapping straight after a dismissal uses stale
  coordinates, so the flow waits for the animation before tapping Next/Save.
- **Tapping by testID is not portable.** On Android the id is exposed on the label node, on iOS on the
  button wrapper, so buttons are tapped by their visible label.
- **`adb reverse` does not survive** every device restart; the Android flow avoids it by using
  `10.0.2.2`.

`dev/dismiss-intro.yaml` remains useful for dismissing the dev-client intro by hand.
