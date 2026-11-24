# Privacy

This app is built for one family, on their own phones, with no backend.

## What the app stores, and where

| Data                                                  | Location                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Records, profile, measurements, medications, settings | SQLite database inside the app's private storage                          |
| Prescription/lab images and PDFs                      | App-private documents directory (`attachments/`), thumbnails in `thumbs/` |
| Exported PDFs                                         | App cache directory, then handed to the OS share sheet                    |
| Backups                                               | A `.zip` you create, then hand to the OS share sheet                      |

Nothing is synced, uploaded or hosted. There is no account.

## Network

The app makes no network calls, with one exception you must explicitly enable:

- **Tier 3 cloud handwriting engine (Phase 9, optional, OFF by default).** If you turn it on, the
  selected image is uploaded to the provider **you** configured, using **your own API key**. A consent
  dialog appears before _every_ upload and states plainly that the image leaves the device. Choose a
  provider that does not train on or human-review your data, and never submit documents you are not
  willing to send to that company.

The development build uses a local Metro server over your LAN while you are developing. Release
builds do not contain or call Metro.

## Device backups

- **Android:** auto-backup is disabled (`android.allowBackup = false`). Google does not receive a copy.
- **iOS:** the app's files are not excluded from iCloud device backup by the OS, so an _encrypted
  iCloud backup of the whole phone_ would include them. If that is not acceptable, turn off iCloud
  Backup for the device, or use the app's own export/import instead.

## Why there is no app lock

Deliberate choice: no biometric or passcode gate, no lockout, no encryption passphrase. The threat
model is "someone picks up the phone", and the phone's own lock screen already covers that. Adding an
app lock would create a second way to lose access to medical data.

## Sharing is the leak vector

The app never transmits anything, but exported PDFs and backup `.zip` files are **plain files**. Once
shared through WhatsApp, Drive, email or AirDrop they leave your control and may be copied into
someone else's cloud. Treat them like a printed medical file.

## This repository is public

Therefore: no real names, documents, dates, values or doctors are ever committed. `private-samples/`
is git-ignored and blocked by a pre-commit hook, as are keystores, certificates and archives. Test
fixtures are synthetic.

## Not medical advice

Every clinically-flavoured label (BMI category, BP category, low/high test flags) is informational.
The app displays: **"Informational only, not medical advice."**
