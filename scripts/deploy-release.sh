#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$ROOT_DIR/sdk/android-sdk}}"
DEFAULT_APK="$ROOT_DIR/build/artifacts/aftertouch-release.apk"
APK_PATH="$DEFAULT_APK"
PACKAGE_NAME="${ANDROID_PACKAGE:-berlin.spengler.aftertouch.app}"
BUILD_RELEASE=auto
LAUNCH_APP=1
DEVICE="${ANDROID_SERIAL:-}"

usage() {
  cat >&2 <<EOF
Usage: $0 [options] [apk-path]

Builds when the release APK is missing, then installs it on a connected Android device.

Options:
  --build          Always rebuild the release APK before installing.
  --no-build       Do not build; fail if the APK does not exist.
  --device SERIAL  Install to the specified adb device serial.
  --launch         Launch the app after installing. This is the default.
  --no-launch      Install only.
  -h, --help       Show this help.

Environment:
  ANDROID_SDK_ROOT or ANDROID_HOME  SDK path. Defaults to sdk/android-sdk.
  ANDROID_SERIAL                   Device serial. Overridden by --device.
  ANDROID_PACKAGE                  Package to launch. Defaults to $PACKAGE_NAME.
EOF
}

log() {
  printf '%s\n' "$*"
}

find_adb() {
  if [ -x "$SDK_DIR/platform-tools/adb" ]; then
    printf '%s\n' "$SDK_DIR/platform-tools/adb"
    return
  fi

  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return
  fi

  echo "adb not found in $SDK_DIR/platform-tools or PATH." >&2
  echo "Set ANDROID_SDK_ROOT, ANDROID_HOME, or add adb to PATH." >&2
  exit 1
}

select_device() {
  if [ -n "$DEVICE" ]; then
    printf '%s\n' "$DEVICE"
    return
  fi

  DEVICES=$("$ADB" devices | awk '$2 == "device" { print $1 }')
  DEVICE_COUNT=$(printf '%s\n' "$DEVICES" | sed '/^$/d' | wc -l | tr -d ' ')

  case "$DEVICE_COUNT" in
    0)
      echo "No connected Android device found." >&2
      echo "Connect a device, enable USB debugging, and accept the debugging prompt." >&2
      exit 1
      ;;
    1)
      printf '%s\n' "$DEVICES"
      ;;
    *)
      echo "Multiple Android devices found. Choose one with --device SERIAL:" >&2
      printf '%s\n' "$DEVICES" >&2
      exit 1
      ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --build)
      BUILD_RELEASE=1
      ;;
    --no-build)
      BUILD_RELEASE=0
      ;;
    --device)
      if [ "$#" -lt 2 ]; then
        echo "--device requires a serial." >&2
        exit 1
      fi
      DEVICE="$2"
      shift
      ;;
    --launch)
      LAUNCH_APP=1
      ;;
    --no-launch)
      LAUNCH_APP=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      APK_PATH="$1"
      ;;
  esac
  shift
done

case "$APK_PATH" in
  /*) ;;
  *) APK_PATH="$ROOT_DIR/$APK_PATH" ;;
esac

ADB=$(find_adb)
DEVICE=$(select_device)

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export ANDROID_SERIAL="$DEVICE"

if [ "$BUILD_RELEASE" = 1 ] || { [ "$BUILD_RELEASE" = auto ] && [ ! -f "$APK_PATH" ]; }; then
  if [ "$APK_PATH" != "$DEFAULT_APK" ]; then
    echo "Cannot build a custom APK path: $APK_PATH" >&2
    echo "Run without an apk-path or build it separately first." >&2
    exit 1
  fi
  log "Building release APK..."
  "$ROOT_DIR/scripts/build-release.sh" apk >/dev/null
fi

if [ ! -f "$APK_PATH" ]; then
  echo "Release APK not found: $APK_PATH" >&2
  echo "Build it with: $ROOT_DIR/scripts/build-release.sh apk" >&2
  exit 1
fi

log "Using Android device: $DEVICE"
log "Installing release APK: $APK_PATH"
"$ADB" install -r "$APK_PATH"

if [ "$LAUNCH_APP" = 1 ]; then
  log "Launching $PACKAGE_NAME..."
  "$ADB" shell monkey -p "$PACKAGE_NAME" 1 >/dev/null
fi

log "Done."
