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
- `src/app/device.tsx`: device status and control screen
- `src/app/_layout.tsx`: shared navigation, status bar setup, safe-area provider, and header styling
- `src/app/+not-found.tsx`: fallback route with home navigation

## Navigation

- Home is reachable at `/`.
- Settings is reachable at `/settings`.
- A device card opens `/device` with the device name and IP address.
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
The settings screen also provides a `Haptic feedback` on/off switch. Its state is stored locally as `aftertouch.haptics.enabled`, defaults to off, and controls feedback for device actions.

## Home

- when the `Aftertouch source` is not empty, use the `Device Discovery API only Read` to get all known devices
- list all known devices on this screen, showing each qualifying device `name` and `ip_address`

## Device Status and Controls

- The device page displays the selected device name and IP address.
- It reads status from the device at `http://<ip_address>:8090/now_playing`, volume from `http://<ip_address>:8090/volume`, and presets from `http://<ip_address>:8090/presets`.
- It displays the source, playback state, track, artist, volume, mute state, and configured presets when returned by the device.
- It supports manual refresh, automatic refresh every 15 seconds, play/pause, power, volume increase, volume decrease, and preset selection actions.
- Key actions use POST `/key` with XML press and release requests.
- Volume actions use POST `/volume` with an XML body in the form `<volume>50</volume>`, with a value from 0 through 100; the volume control is one pill-shaped element containing a 0–100 slider, with a minus button on the left and a plus button on the right; both buttons change volume in steps of 1.

## Using API

### Device Discovery API only Read

- Read discovered devices with `GET /setup/devices` on the local AfterTouch service.
- Return a JSON array containing objects with `name`, `ip_address`, and `device_serial_number`.
- The app displays only devices with a non-empty `device_serial_number`.

### Now Playing Status API

- Read the current device status with `GET http://<ip_address>:8090/now_playing`.
- Parse the XML response for the source, playback state, track, and artist.

### Presets API

- Read configured presets with `GET http://<ip_address>:8090/presets`.
- Parse the XML response and display each preset as a button in a 3-column by 2-row block between Status and Volume on the device page.
- Use `containerArt` as the button image; when it is empty, display the lowercased `itemName` instead.
- Selecting a preset sends the corresponding `PRESET_<id>` key command.

### Volume API

- Read the current volume and mute state with `GET http://<ip_address>:8090/volume`.
- Set the volume with `POST http://<ip_address>:8090/volume` using an XML body in the form `<volume>50</volume>` with a value from 0 through 100.

### Key Control API

- Send device controls with `POST http://<ip_address>:8090/key`.
- Each key action sends XML `press` and `release` requests with sender `Gabbo`.
- The device page currently supports `PLAY_PAUSE` and `POWER`.


## Testing

- Home device loading is covered by `tests/index.test.tsx`.
- The test uses `test-data/setup-devices.json` as the mocked `GET /setup/devices` response.
- Dedicated device API fixtures are stored in `test-data/now-playing.xml`, `test-data/volume.xml`, `test-data/presets.xml`, and `test-data/key-response.xml`.
- The device API fixtures represent the `/now_playing`, `/volume`, and `/presets` responses, plus the documented `/key` success response.
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
- Run on a connected Android device with `npm run android:device`; the runner proceeds only when ADB reports a device in `device` state
- Mirror helper: `./scripts/mirror-android-sdk.sh`
- Native Android project is generated with `npx expo prebuild --platform android`
- Default release format is APK via `npm run build:release`
- Splash screen uses `expo-splash-screen`
- If native module Kotlin compilation breaks after dependency updates, refresh compatibility with `npx expo install react-native-safe-area-context react-native-screens`.
