#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUILD_DIR="$ROOT_DIR/build"
ANDROID_DIR="$ROOT_DIR/android"
BUILD_ANDROID_DIR="$BUILD_DIR/android"
SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$ROOT_DIR/sdk/android-sdk}}"

rm -rf "$BUILD_ANDROID_DIR" "$ANDROID_DIR" "$BUILD_DIR/.android-native.signature"
mkdir -p "$BUILD_DIR"

npm install

if [ -d "$ROOT_DIR/node_modules" ] && [ ! -L "$ROOT_DIR/node_modules" ]; then
  rm -rf "$BUILD_DIR/node_modules"
  mv "$ROOT_DIR/node_modules" "$BUILD_DIR/node_modules"
fi
if [ ! -e "$ROOT_DIR/node_modules" ]; then
  ln -s build/node_modules "$ROOT_DIR/node_modules"
fi
npx expo prebuild --platform android --clean --no-install

if [ ! -d "$ANDROID_DIR" ]; then
  echo "expo prebuild did not create the android/ directory" >&2
  exit 1
fi

printf 'sdk.dir=%s\n' "$SDK_DIR" > "$ANDROID_DIR/local.properties"
sed -i "/ndkVersion rootProject.ext.ndkVersion/d" "$ANDROID_DIR/app/build.gradle"

cp -R "$ANDROID_DIR" "$BUILD_ANDROID_DIR"
