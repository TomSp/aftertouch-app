# Android SDK Mirror

This directory is used as the repo-local Android SDK mirror for builds.

Prepare it by downloading the official Android command-line tools and installing the required packages:

```bash
./scripts/mirror-android-sdk.sh
```

The script downloads Android CLI tools, accepts the SDK licenses, and installs:

- `platform-tools`
- `build-tools;36.0.0`
- `platforms;android-36`
- `ndk;27.1.12297006`

Build scripts default to `sdk/android-sdk` unless `ANDROID_HOME` or `ANDROID_SDK_ROOT` overrides it.
