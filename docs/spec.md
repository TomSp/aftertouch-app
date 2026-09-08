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

- `src/app/index.tsx`: home screen with centered red `Hello` text and a gear icon for settings
- `src/app/settings.tsx`: settings screen for device discovery configuration and API reference
- `src/app/details.tsx`: sample secondary screen
- `src/app/_layout.tsx`: shared navigation and status bar setup

## Navigation

- Home is reachable at `/`.
- Settings is reachable at `/settings`.
- The home screen exposes settings through a conventional gear icon in the top-right corner.

## Using API
### Device Discovery API only Read

- Read discovered devices with `GET /setup/devices` on the local AfterTouch service.

## Branding

- App icon: `assets/icon.png`
- Adaptive icon: `assets/adaptive-icon.png`
- Splash image: `assets/splash.png`
- Source logo: `assets/logo.svg`

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
