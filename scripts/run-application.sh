#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$ROOT_DIR/sdk/android-sdk}}"
ADB="$SDK_DIR/platform-tools/adb"
STAMP_FILE="$ROOT_DIR/build/.android-native.signature"

log() {
  printf '%s\n' "$*"
}

native_signature() {
  sha256sum \
    "$ROOT_DIR/package.json" \
    "$ROOT_DIR/package-lock.json" \
    "$ROOT_DIR/app.json" \
    "$ROOT_DIR/babel.config.js" \
    2>/dev/null | sha256sum | awk '{print $1}'
}

rebuild_android_if_needed() {
  CURRENT_SIGNATURE=$(native_signature)
  STORED_SIGNATURE=""
  if [ -f "$STAMP_FILE" ]; then
    STORED_SIGNATURE=$(cat "$STAMP_FILE")
  fi

  if [ "$CURRENT_SIGNATURE" != "$STORED_SIGNATURE" ]; then
    log "Native inputs changed; regenerating the Android project..."
    "$ROOT_DIR/scripts/build.sh"
    mkdir -p "$(dirname "$STAMP_FILE")"
    POST_BUILD_SIGNATURE=$(native_signature)
    printf '%s\n' "$POST_BUILD_SIGNATURE" > "$STAMP_FILE"
  else
    log "Native inputs unchanged; skipping Android regeneration."
  fi
}

if [ ! -x "$ADB" ]; then
  echo "adb not found in $ADB" >&2
  exit 1
fi

DEVICE=$($ADB devices | awk '$2 == "device" { print $1; exit }')
if [ -z "$DEVICE" ]; then
  echo "No connected Android device found." >&2
  echo "Connect a device and enable USB debugging, then retry." >&2
  exit 1
fi

export ANDROID_SDK_ROOT="$SDK_DIR"
export ANDROID_HOME="$SDK_DIR"
export ANDROID_SERIAL="$DEVICE"

log "Using connected Android device: $DEVICE"

rebuild_android_if_needed

log "Launching app on $DEVICE..."
exec npx expo run:android
