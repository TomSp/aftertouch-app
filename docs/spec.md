# Project Spec

Date: 2026-09-08

## Purpose

Expo-based Android app starter for Aftertouch.

## Stack

- Expo
- React Native
- TypeScript
- Expo Router

## App Structure

- `src/app/index.tsx`: home screen with centered red `Aftertouch App` title and a top-right gear icon for settings
- `src/app/settings.tsx`: settings screen reachable from the gear icon and header navigation, with an `Aftertouch source` field
- `src/app/details.tsx`: sample secondary screen
- `src/app/_layout.tsx`: shared navigation, status bar setup, safe-area provider, and header styling
- `src/app/+not-found.tsx`: fallback route with home navigation

## Navigation

- Home is reachable at `/`.
- Settings is reachable at `/settings`.
- The home screen exposes settings through a conventional gear icon in the top-right corner.
- The shared header shows `assets/icon.png` on the left side.
- The header-left app icon is clickable and navigates to `/`.
- Stack titles are
  - `Home` for `/`
  - `Settings` for `/settings`

## Settings

- The settings screen contains an `Aftertouch source` text field. Its value must match `protocol://host:port`,
with an `http` or `https` protocol, host, and port from `1` through `65535`.
The last valid value is stored locally as an application setting and restored when the settings screen opens.

## Home

- when the `Aftertouch source` is not empty, use the `Device Discovery API only Read` to get all known devices
- list all known devices on this screen, showing each qualifying device `name` and `ip_address`

## Using API

### Device Discovery API only Read

- Read discovered devices with `GET /setup/devices` on the local AfterTouch service.
- Return a Json-Array, containing objects containing name and ip_address
and filter for devices having a non-empty `device_serial_number`

## Testing

- Home device loading is covered by `tests/index.test.tsx`.
- The test uses `test-data/setup-devices.json` as the mocked `GET /setup/devices` response.
- It verifies that only fixture devices with a non-empty `device_serial_number` are rendered with their `name` and `ip_address`, and that the configured API URI is requested.
- Run the test suite with `npm test -- --runInBand`.

## Branding

- App icon: `assets/icon.png`
- Adaptive icon: `assets/adaptive-icon.png`
- Splash image: `assets/splash.png`
- Source logo: `assets/logo.svg`
- Header icon source: `assets/icon.png`

## Build Notes

- Android package: `berlin.spengler.aftertouch.app`
- Android base: API 36 / Android 16 via `expo-build-properties`
- SDK mirror downloads into `sdk/android-sdk` by default
- Run locally with `ANDROID_SDK_ROOT=$PWD/sdk/android-sdk` to keep builds on the cached mirror
- Mirror helper: `./scripts/mirror-android-sdk.sh`
- Native Android project is generated with `npx expo prebuild --platform android`
- Default release format is APK via `npm run build:release`
- Splash screen uses `expo-splash-screen`
- If native module Kotlin compilation breaks after dependency updates, refresh compatibility with `npx expo install react-native-safe-area-context react-native-screens`.
