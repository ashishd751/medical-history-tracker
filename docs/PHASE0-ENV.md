# Phase 0 environment audit

Recorded on 24 Nov 2026. Every value below was observed by running a command, not assumed.

## Machine

| Item               | Value                 |
| ------------------ | --------------------- |
| macOS              | 26.7.1 (build 25G241) |
| Architecture       | arm64 (Apple Silicon) |
| Free disk at audit | ~131 GB               |

## Toolchain

| Tool                  | Version                                                          | Verified by                                 |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Node                  | 24.14.0                                                          | `node -v` (SDK 58 requires 22.13/24.3+/26+) |
| npm                   | 11.19.0                                                          | `npm -v`                                    |
| Git                   | 2.53.0 (Homebrew)                                                | `git --version`                             |
| JDK                   | OpenJDK 17.0.21.1 (Homebrew `openjdk@17`)                        | `java -version`                             |
| `JAVA_HOME`           | `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` | `echo $JAVA_HOME`                           |
| CocoaPods             | 1.17.0                                                           | `pod --version`                             |
| Xcode                 | 27.2 (build 27B52)                                               | `xcodebuild -version`                       |
| iOS SDK               | 27.2                                                             | `xcrun --sdk iphoneos --show-sdk-version`   |
| iOS simulator runtime | iOS 27.2                                                         | `xcrun simctl list runtimes`                |
| `xcode-select`        | `/Applications/Xcode.app/Contents/Developer`                     | `xcode-select -p`                           |
| Xcode first launch    | complete, licence accepted                                       | `xcodebuild -checkFirstLaunchStatus` → 0    |
| Watchman              | not installed (not required for SDK 58)                          | ADR-012                                     |

## Android SDK (`~/Library/Android/sdk`, 3.2 GB)

| Package                  | Version              | Needed because            |
| ------------------------ | -------------------- | ------------------------- |
| `platform-tools`         | 37.0.3               | adb                       |
| `build-tools`            | 37.0.0               | RN 0.88 template          |
| `platforms;android-37.0` | Android 17, API 37   | `compileSdkVersion = 37`  |
| `platforms;android-36`   | API 36               | `targetSdkVersion = 36`   |
| `ndk`                    | 27.1.12297006 (r27b) | RN native build           |
| `cmake`                  | 3.22.1               | AGP external native build |
| `cmdline-tools;latest`   | 22.0                 | sdkmanager                |

Android Studio **2026.2** (build `AI-262.10968.63.2622.16975389`) installed at `/Applications`.

Declared by the RN 0.88 template: `minSdk 24`, `compileSdk 37`, `targetSdk 36`,
`buildTools 37.0.0`, `ndk 27.1.12297006`, `kotlin 2.2.0`, Gradle wrapper 9.4.1.

## Devices

| Device                     | OS                           | Notes                                                           |
| -------------------------- | ---------------------------- | --------------------------------------------------------------- |
| iPhone 17 (iPhone18,3)     | iOS 27.2.1                   | visible to `xcrun devicectl list devices` as connected          |
| OnePlus Nord CE5 (CPH2717) | Android 16 / OxygenOS 16.0.5 | connected; was `unauthorized` until USB debugging was confirmed |

## Project versions (installed)

Expo 58.0.26 · React Native 0.88.1 · React 19.3.0 · TypeScript 6.0.3 · Expo Router 58.0.32 ·
react-native-paper 5.15.5 · zod 4.6.7 · drizzle-orm 0.45.4 · jest 30.5.2 · jest-expo 58.0.15 ·
@testing-library/react-native 14.1.0 · ESLint 9.39.5 · husky 9.1.7

## Environment variables

Set in `~/.zshrc` for **interactive** shells (Terminal, VS Code terminal):

```
JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT
PATH += $JAVA_HOME/bin, platform-tools, emulator, cmdline-tools/latest/bin
```

Non-interactive `zsh -c` does not read `.zshrc`; if a tool complains about a missing `JAVA_HOME`,
move these exports to `~/.zshenv`.

## Not installed, deliberately

- Watchman (not required, ADR-012)
- Azul Zulu 17 (used Homebrew `openjdk@17`, ADR-002)
- Android emulator system images (physical devices available; can be added on request)
