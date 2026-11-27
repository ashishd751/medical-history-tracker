# Testing on the simulator and emulator

How to exercise this app by hand on both platforms without a physical phone. Everything here uses
invented data; never put real medical documents in the repo or in a fixture script.

Exact tool versions are in `docs/PHASE0-ENV.md`. The short list: macOS on arm64, Node 24, JDK **17**
(not 26/27 — Android builds break), Android SDK 36/37 + NDK 27.1.12297006, Xcode 27.2 with the iOS
27.2 SDK.

## 1. Devices

| Platform | Device                                                   | Identifier                             |
| -------- | -------------------------------------------------------- | -------------------------------------- |
| iOS      | `iPhone 18 Pro`, iOS 27.2                                | `D65428AF-F679-40FB-817B-FCC564B975C6` |
| Android  | AVD `mht_play`, Pixel 10, 1080×2424, Android 16 / API 36 | `emulator-5554`                        |

```bash
# Android emulator, headless
$ANDROID_HOME/emulator/emulator -avd mht_play -no-window -no-audio -no-boot-anim -no-snapshot \
  -gpu swiftshader_indirect &
adb shell getprop sys.boot_completed      # wait for 1

# Recreate the AVD only if it is missing (always pass a device profile; without one it is 320×640)
echo no | avdmanager create avd -n mht_play \
  -k "system-images;android-36;google_apis_playstore;arm64-v8a" --device pixel_10
```

## 2. Run the app

App identity `com.ashishd751.medicalhistory`, scheme `medicalhistory`. `android/` and `ios/` are
git-ignored (Continuous Native Generation); rebuild after changing `app.json` or adding a native
module (`npx expo prebuild --platform <ios|android> --no-install`, `cd ios && pod install`).

```bash
# Metro (leave running)
npx expo start --dev-client --port 8081

# iOS simulator
xcrun simctl openurl booted "medicalhistory://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

# Android emulator (10.0.2.2 is the host loopback from inside the emulator)
adb shell am start -a android.intent.action.VIEW \
  -d "medicalhistory://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

# Native rebuilds when needed
cd ios && xcodebuild -workspace MedicalHistory.xcworkspace -scheme MedicalHistory \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 18 Pro' \
  -derivedDataPath /tmp/mht-dd build
cd android && ./gradlew assembleDebug      # app/build/outputs/apk/debug/app-debug.apk
```

The dev client shows its own launcher and a one-time intro, and on Android an in-app dev menu. Those
screens belong to the client, not to this app.

## 3. Automated checks

```bash
npm run typecheck && npm run lint && npm run deps:check && npm run format:check && npm test
npm run doctor
```

Maestro (2.12.1, `~/.maestro/bin`) needs `--device` when both devices are attached:

```bash
maestro --device D65428AF-F679-40FB-817B-FCC564B975C6 test --env EXPO_URL='medicalhistory://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081' --env METRO_HOST='localhost:8081' .maestro/records/create-manual.yaml
maestro --device emulator-5554 test --env EXPO_URL='medicalhistory://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081' --env METRO_HOST='10.0.2.2:8081' .maestro/records/create-manual.yaml
```

Reading the screen without a screenshot: `maestro --device <id> hierarchy`, or
`adb shell uiautomator dump /sdcard/w.xml && adb pull /sdcard/w.xml`.

**Tapping buttons.** Maestro taps by visible label on iOS (a testID lands on the wrapper and can
"complete" without pressing anything) and by testID on Android (`id: "add-photo-prescription"`).

## 4. Synthetic fixtures

Never use a real document. This script builds everything Phase 2 needs:

```bash
mkdir -p /tmp/mht-fixtures && cd /tmp/mht-fixtures
python3 make_fixtures.py            # transparent PNG, oversized PDF, corrupt .jpg, 2-page PDF
sips -s format jpeg -s formatOptions 92 portrait-source.png --out portrait-base.jpg
# add an EXIF orientation tag (6 = rotate 90° clockwise when displaying)
python3 - <<'PY'
import struct
data = open('portrait-base.jpg','rb').read()
tiff = b'II*\x00' + struct.pack('<I',8) + struct.pack('<H',1) + \
       struct.pack('<HHI',0x0112,3,1) + struct.pack('<HH',6,0) + struct.pack('<I',0)
payload = b'Exif\x00\x00' + tiff
seg = b'\xff\xe1' + struct.pack('>H', len(payload)+2) + payload
open('portrait-exif6.jpg','wb').write(data[:2] + seg + data[2:])
PY
sips -s format jpeg -s formatOptions 95 large-source.png --out large-photo.jpg   # > 3000 px, > 3 MB
printf 'Synthetic report\\nResult: invented value 4.2\\n\\fPage two\\n' > report.txt
/usr/sbin/cupsfilter -m application/pdf report.txt > two-page-report.pdf
```

Two traps worth knowing:

- A hand-written PDF whose content stream is subtly wrong renders **blank** in Android's
  `PdfRenderer` while looking fine in a text editor. `cupsfilter` produces a PDF that really paints
  text. Check any PDF with `qlmanage -t -s 800 -o /tmp <file>.pdf` before blaming the app.
- `sips -s format png file.pdf` renders a blank image; it is not a PDF renderer. Use `qlmanage`.

## 5. Getting files onto the devices

```bash
# iOS photo library (images only)
xcrun simctl addmedia booted /tmp/mht-fixtures/portrait-exif6.jpg

# iOS Files: no headless way. Drag a PDF onto the Simulator window and save it to "On My iPhone",
# or use the document picker's "Recents" if it is already there. This is the one step that needs
# Simulator.app.

# Android photos
adb push /tmp/mht-fixtures/portrait-exif6.jpg /sdcard/Pictures/
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Pictures/portrait-exif6.jpg

# Android documents: pushing alone is NOT enough; scan it so it appears under "Recent files"
adb push /tmp/mht-fixtures/two-page-report.pdf /sdcard/Download/
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Download/two-page-report.pdf
```

## 6. Manual checklist — attachments (Phase 2)

Work through this on the iOS simulator **and** the Android emulator unless a step says otherwise.
For each step the expected result is given; anything else is a bug worth writing down.

### A. The form's Prescription section

1. Home → the centre **+** → **Fill in manually**.
2. Scroll to **Prescription**. Expect: the hint "Add a photo or file of the prescription, type it
   below, or do both.", **Add photo** and **Add file**, the **Prescription text** field _inside_
   this section, and a counter line reading **0 of 10**.
3. Tap **Add photo**. Expect the system photo picker — on Android the "will only have access to the
   photos you select" sheet, on iOS the Photos sheet. **There must be no camera option anywhere.**
4. Pick `portrait-exif6.jpg`. Expect, after a moment: a square thumbnail in the section, the caption
   "Prescription", a red **Remove** under it, and **1 of 10**.
5. Tap **Add file** and cancel the picker. Expect **no** banner and no error: cancellation is not a
   failure.
6. Repeat with a `.txt` file (unsupported), a 26 MB PDF, and a text file renamed `corrupt.jpg`.
   Expect, respectively: "That file type is not supported…", "That file is larger than 25 MB.", and
   "That file could not be read. It may be damaged." Nothing is added in any case.

### B. The form's Reports and other files section

1. Expect three actions: **Add photo**, **Add lab report**, **Add other file**.
2. Attach `two-page-report.pdf` with **Add lab report**. Expect a tile whose thumbnail is the first
   page, captioned **PDF**, and a counter of **2 of 10**.
3. Attach a PNG with transparency through **Add photo** (for example `transparent.png`). The stored
   image should end up with a white background, not black.

### C. Save, gallery and viewer

1. Type a title (it is required) and tap **Save**. Expect the new record's detail screen.
2. Expect an **Attachments** card with one group per role, each tile captioned **Image** or **PDF**,
   and the typed prescription text still shown beside the gallery.
3. Tap an image tile. Expect a full-screen viewer. Pinch to zoom (1–5×), drag to pan (only while
   zoomed), double-tap to toggle between fit and 2.5×. Zooming right out re-centres the image.
4. Go back and use **Open lab report** (or the viewer's **Open**). Expect the system share sheet with
   a PDF reader in the list. Cancelling it must return to the app unchanged.
5. Delete the record and confirm. Expect the list again and, after the next launch, no leftover
   attachment folder (checked in section 7).

### D. Unsaved drafts and a killed app

1. Start a new record, attach a photo, type a title, and wait about a second (the draft autosaves).
2. Kill the app: `xcrun simctl terminate booted com.ashishd751.medicalhistory` or
   `adb shell am force-stop com.ashishd751.medicalhistory`.
3. Relaunch it (section 2), then **+ → Fill in manually**.
4. Expect the banner "Unsaved draft restored." and the attachment tile still there. The startup
   sweeper must **not** have deleted the staged file.
5. Press Back. Expect "Discard changes?"; choose **Discard**. The staged file should then be gone.

### E. What to look for while testing

- Every user-facing date is `DD/MM/YYYY`; no `YYYY-MM-DD` anywhere.
- Long lists: with ten attachments the form still scrolls smoothly and the Save footer stays pinned.
- Dark mode: repeat step C on iOS in dark mode and on Android in light.

## 7. Looking at the stored files and rows

Relative paths are `attachments/<personId>/<recordId>/<attachmentId>.<ext>` and
`thumbs/<attachmentId>.jpg`, all under the app's documents directory.

```bash
# Android (debug build)
adb shell run-as com.ashishd751.medicalhistory ls -R files/
adb shell 'run-as com.ashishd751.medicalhistory cat files/SQLite/medical-history.db' > /tmp/mht.db
python3 - <<'PY'
import sqlite3
conn = sqlite3.connect('/tmp/mht.db')
for row in conn.execute('select id, role, mime, rel_path, thumb_rel_path, bytes, length(sha256) '
                        'from attachment'):
    print(row)
PY

# iOS simulator container (look under Documents/)
xcrun simctl get_app_container booted com.ashishd751.medicalhistory data

# Confirm a stored image is upright and resized
adb shell 'run-as com.ashishd751.medicalhistory cat files/attachments/.../<id>.jpg' > /tmp/stored.jpg
sips -g pixelWidth -g pixelHeight /tmp/stored.jpg
```

Expected: an EXIF-rotated portrait is stored upright (a 1400×1000 file tagged orientation 6 becomes
1000×1400), no larger than 2000 px, with no `Exif` segment left; `sha256` is 64 hex characters and
`bytes` matches the file.

## 8. No camera, no network

```bash
# Android: the installed app must not request the camera
adb shell dumpsys package com.ashishd751.medicalhistory | grep -i camera      # prints nothing
# iOS: no camera usage string in the built Info.plist
plutil -p ios/MedicalHistory/Info.plist | grep -i camera                     # prints nothing
```

Before a release build, repeat the pick-and-save flow in airplane mode: everything except the
optional Phase 9 engine must work with the radio off.

## 9. Phase 1 smoke test (5 minutes, after any change)

1. Fresh install: onboarding asks for name, date of birth and sex, then height/weight, then the
   optional health basics; finishing lands on Home with a derived BMI.
2. Create a record with a doctor, symptoms, a medication, a reading and BP; save; reopen it.
3. Records tab: search a symptom fragment (three or more letters), use the type and period filters,
   and scroll past the first 25 rows.
4. Edit the record, change the date, save; the timeline re-sorts.
5. Delete the record; Home's snapshot and the timeline update.

## 10. Leaving the devices as you found them

```bash
# Android: remove pushed fixtures
adb shell rm -f /sdcard/Pictures/<file> /sdcard/Download/<file>

# iOS: terminate the app (the simulator's photo library keeps anything added with addmedia)
xcrun simctl terminate booted com.ashishd751.medicalhistory
```

Delete any synthetic record through the app so its files go too, discard drafts so `staging/` is
empty, and restore any font scale, density or appearance you changed.

## 11. Known gaps at the end of Phase 2

- The iOS photo/files pickers could not be exercised under Maestro in this session: the taps
  completed, no picker appeared, and no error banner was shown. A manual pass on the simulator is
  the next thing to do (section 6, step A3).
- Pinch-zoom is not measurable with Maestro; double-tap and pan are the practical checks.
- At the largest accessibility text size a record-row badge can wrap (deferred to the Phase 8
  accessibility audit).

- A large text size (Android: Settings → Display → Font size) should not clip the section titles.
