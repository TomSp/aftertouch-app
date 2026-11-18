# Android SDK Mirror

This directory is used as the repo-local Android SDK mirror for builds.

Prepare it by downloading the official Android command-line tools and installing the required packages:

```bash
./scripts/mirror-android-sdk.sh
```

The script downloads Android CLI tools, accepts the SDK licenses, and installs:

- `platform-tools`
- `build-tools;37.0.0`
- `platforms;android-37`
- `ndk;27.1.12297006`
- `emulator`
- `system-images;android-36;google_apis;x86_64`

It also creates the `aftertouch_api36` virtual device in `.android/avd` (or
`ANDROID_AVD_HOME` when set), preserving an existing device with that name.
The emulator image is for Linux x86_64 hosts. Start it with:

```bash
./scripts/start-emulator.sh
```

Build scripts default to `sdk/android-sdk` unless `ANDROID_HOME` or `ANDROID_SDK_ROOT` overrides it.
