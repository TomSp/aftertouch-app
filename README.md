# Aftertouch Android App 

This repository is scaffolded as an Expo + TypeScript Android app.

The app uses Expo SDK 58 and React Native 0.88. Use Node.js 24.15 or newer on the Node.js 24 release line (24.22.1 is verified).

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
   - The helper installs Android API 37 platform support, Build-Tools 37.0.0, NDK 27.1.12297006, and the emulator with an API 36 virtual device.
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
   - The emulator starts with a visible window using a Xiaomi Mi 10T Pro screen profile (1080 × 2400, approximately 395 dpi). It cold boots with existing user data to apply the screen size. Use `EMULATOR_HEADLESS=1 npm run emulator` if you want it hidden.
   - Then run the app against a connected Android device with:
     ```bash
     npm run android:device
     ```
   - The `npm run android:device` launcher now regenerates the Android project only when native inputs change.
   - The launcher requires a full JDK with `java` and `javac`. Set `JAVA_HOME` explicitly, or let it find a JDK on `PATH`, in the Gradle JDK cache, or under `/usr/lib/jvm`.
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

## Deploy Released APK To A Device

1. Enable Developer options and USB debugging on the Android device, connect it by USB, and accept the debugging prompt.
2. Deploy the release APK:

   ```bash
   export ANDROID_SDK_ROOT="$PWD/sdk/android-sdk"
   npm run deploy:release
   ```

The deploy script builds `build/artifacts/aftertouch-release.apk` if it is missing, installs it with `adb install -r`, and launches the app. To force a fresh release build before installing:

```bash
npm run deploy:release -- --build
```

If more than one device is connected, pass a serial with `npm run deploy:release -- --device SERIAL`. If the device is listed as `unauthorized`, accept the USB debugging prompt on the device and retry. Use `--no-launch` to install without starting the app.

## Publish A GitHub Release

Release automation requires a clean git worktree and the GitHub CLI (`gh`) authenticated for this repository. It builds the current app version (or bumps the minor version before building when a minor bump is requested), proposes release notes from commit messages since the latest `v*` tag, creates and pushes a `vX.Y.Z` tag, publishes the built artifact as a GitHub release, then bumps the patch version and pushes that bump commit. The generated notes open in an editor before publishing. Set `RELEASE_EDITOR` to choose the editor, or set `RELEASE_NOTES` to change the initial text.

```bash
npm run release:github
```

Build and publish an Android App Bundle instead of the APK:

```bash
npm run release:github -- aab
```

Bump the minor version instead of patch:

```bash
npm run release:github -- minor
# or: npm run release:github -- aab minor
```

## Notes

- Dependencies follow Expo SDK 58's supported versions, including React 19.3.0, AsyncStorage 2.2.0, Slider 5.2.1, and TypeScript 6.0.3.
- The `minimatch@^10` override uses patched 11.x releases for Expo fingerprinting and test coverage ([security advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)). Jest's vulnerable `deepmerge` dependency is replaced by the local `tools/jest-deepmerge` adapter backed by `@fastify/deepmerge`. It supports Jest's pair and `.all` merge calls, preserves array concatenation and cloning, and rejects custom merge options. Regression tests cover configuration merging and prototype poisoning. Remove this override when Jest ships an upstream fix. The `.npmrc` setting packs the adapter so `scripts/build.sh` can relocate `node_modules` safely.
- The native Android project is generated on demand and is not committed to the repo.
- Update `app.json` if you need to change the Android package name.
- Release builds require Android signing to be configured in the generated native project.
- The generated project writes `android/local.properties` with the configured SDK mirror path.
- If Gradle fails compiling native modules after an Expo or React Native update, run `npx expo install react-native-safe-area-context react-native-screens` and rebuild.
- The emulator helper uses the repo-local AVD in `.android/avd/aftertouch_api36.avd`; the app runner requires any connected Android device and uses the Android SDK mirror in `sdk/android-sdk`.
