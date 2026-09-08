#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$ROOT_DIR/sdk/android-sdk}}"
AVD_HOME="${ANDROID_AVD_HOME:-$ROOT_DIR/.android/avd}"
AVD_NAME="${1:-aftertouch_api36}"
EMULATOR_ACCEL="${EMULATOR_ACCEL:-auto}"
EMULATOR_HEADLESS="${EMULATOR_HEADLESS:-0}"
EMULATOR_WIPE_DATA="${EMULATOR_WIPE_DATA:-0}"

log() {
  printf '%s
' "$*"
}

if [ ! -x "$SDK_DIR/emulator/emulator" ]; then
  echo "Android emulator not found in $SDK_DIR/emulator/emulator" >&2
  exit 1
fi

if [ ! -f "$AVD_HOME/$AVD_NAME.ini" ]; then
  echo "AVD $AVD_NAME not found in $AVD_HOME" >&2
  echo "Expected: $AVD_HOME/$AVD_NAME.ini" >&2
  exit 1
fi

export ANDROID_SDK_ROOT="$SDK_DIR"
export ANDROID_HOME="$SDK_DIR"
export ANDROID_AVD_HOME="$AVD_HOME"

log "Using Android SDK: $SDK_DIR"
log "Using AVD home: $AVD_HOME"
log "Starting emulator: $AVD_NAME"
log "Emulator acceleration: $EMULATOR_ACCEL"
if [ "$EMULATOR_HEADLESS" = "1" ]; then
  log "Display mode: headless"
else
  log "Display mode: visible window"
fi
if [ "$EMULATOR_WIPE_DATA" = "1" ]; then
  log "Boot mode: full wipe"
else
  log "Boot mode: keep snapshot state for faster restarts"
fi

EMULATOR_ARGS="-avd $AVD_NAME -no-audio -no-boot-anim -gpu swiftshader_indirect -accel $EMULATOR_ACCEL"
if [ "$EMULATOR_HEADLESS" = "1" ]; then
  EMULATOR_ARGS="$EMULATOR_ARGS -no-window"
fi
if [ "$EMULATOR_WIPE_DATA" = "1" ]; then
  EMULATOR_ARGS="$EMULATOR_ARGS -wipe-data"
fi

# shellcheck disable=SC2086
"$SDK_DIR/emulator/emulator" $EMULATOR_ARGS &
EMULATOR_PID=$!

cleanup() {
  kill "$EMULATOR_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

log "Waiting for adb device connection..."
"$SDK_DIR/platform-tools/adb" wait-for-device
log "adb device connected. Waiting for Android boot completion..."

BOOT_ATTEMPTS=0
while :; do
  BOOT_COMPLETED=$("$SDK_DIR/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '
')
  if [ "$BOOT_COMPLETED" = "1" ]; then
    break
  fi
  BOOT_ATTEMPTS=$((BOOT_ATTEMPTS + 1))
  if [ $((BOOT_ATTEMPTS % 15)) -eq 0 ]; then
    log "Still booting... attempt $BOOT_ATTEMPTS"
  fi
  sleep 2
done

log "Emulator $AVD_NAME is ready on adb."
wait "$EMULATOR_PID"
