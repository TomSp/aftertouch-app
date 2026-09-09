# Aftertouch Android App Starter

This repository is scaffolded as an Expo + TypeScript Android app starter.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Prepare the Android SDK mirror:
   - The build flow downloads the Android SDK into `sdk/android-sdk`.
   - Run the mirror helper on a machine with internet access:
     ```bash
     ./scripts/mirror-android-sdk.sh
     ```
   - The helper installs Android 16 platform support, Build-Tools 36.x, and NDK 27.1.12297006.
   - The build scripts use `sdk/android-sdk` by default unless `ANDROID_SDK_ROOT` or `ANDROID_HOME` overrides it.

3. Run locally with the cached SDK mirror:
   ```bash
   export ANDROID_SDK_ROOT="$PWD/sdk/android-sdk"
   npm run android
   ```
   - This keeps local Expo and Gradle builds pointed at the repo cache instead of a system SDK.
   - If you want to start the emulator first, use:
     ```bash
     npm run emulator
     ```
   - The emulator starts with a visible window by default. Use `EMULATOR_HEADLESS=1 npm run emulator` if you want it hidden.
   - Then run the app against a connected Android device with:
     ```bash
     npm run android:device
     ```
   - The `npm run android:device` launcher now regenerates the Android project only when native inputs change.
   - If you prefer the lower-level flow, run `npm run android` in a second terminal after the device is connected.

4. Build the APK when needed:
   ```bash
   npm run build:release
   ```

## Native Android build

Generate the native Android project into `build/android`:

```bash
./scripts/build.sh
```

Build a release APK from the generated native project:

```bash
npm run build:release
```

You can still build a release bundle explicitly:

```bash
npm run build:aab
```

Or run the APK build directly:

```bash
npm run build:apk
```

Release artifacts are copied to `build/artifacts/`.

## Install To Phone

Install the release APK to a connected Android device with `adb`:

```bash
adb devices
adb install -r build/artifacts/aftertouch-release.apk
```

Notes:

- Enable USB debugging on the phone before connecting it.
- If `adb devices` shows `unauthorized`, accept the debugging prompt on the phone and run the command again.
- Use `-r` to replace an existing install without uninstalling first.

## Notes

- The native Android project is generated on demand and is not committed to the repo.
- Update `app.json` if you need to change the Android package name.
- Release builds require Android signing to be configured in the generated native project.
- The generated project writes `android/local.properties` with the configured SDK mirror path.
- If Gradle fails compiling native modules after an Expo or React Native update, run `npx expo install react-native-safe-area-context react-native-screens` and rebuild.
- The emulator helper uses the repo-local AVD in `.android/avd/aftertouch_api36.avd`; the app runner requires any connected Android device and uses the Android SDK mirror in `sdk/android-sdk`.
