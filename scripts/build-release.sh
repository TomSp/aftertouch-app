#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUILD_DIR="$ROOT_DIR/build"
ANDROID_DIR="$ROOT_DIR/android"
OUTPUT_DIR="$BUILD_DIR/artifacts"
MODE="${1:-apk}"
SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$ROOT_DIR/sdk/android-sdk}}"

"$ROOT_DIR/scripts/build.sh"

preflight() {
  if [ ! -d "$SDK_DIR" ]; then
    echo "Android SDK mirror not found: $SDK_DIR" >&2
    echo "Prepare it with: ./scripts/mirror-android-sdk.sh /path/to/Android/Sdk" >&2
    exit 1
  fi

  if [ ! -d "$SDK_DIR/licenses" ]; then
    echo "Android SDK licenses directory missing: $SDK_DIR/licenses" >&2
    echo "Mirror a licensed SDK into sdk/android-sdk before building." >&2
    exit 1
  fi

  if [ ! -f "$SDK_DIR/licenses/android-sdk-license" ] && [ ! -f "$SDK_DIR/licenses/android-sdk-preview-license" ]; then
    echo "Android SDK license files are missing under $SDK_DIR/licenses." >&2
    echo "Accept licenses in Android Studio or sdkmanager, then mirror the SDK again." >&2
    exit 1
  fi

  if [ ! -d "$SDK_DIR/ndk/27.1.12297006" ]; then
    echo "Android NDK 27.1.12297006 is not installed under $SDK_DIR/ndk." >&2
    echo "Install it in the source SDK before mirroring: ndk;27.1.12297006" >&2
    exit 1
  fi
}

preflight

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"

mkdir -p "$OUTPUT_DIR"
cd "$ANDROID_DIR"

case "$MODE" in
  apk)
    ./gradlew assembleRelease
    ARTIFACT="app/build/outputs/apk/release/app-release.apk"
    OUTPUT_FILE="$OUTPUT_DIR/aftertouch-release.apk"
    ;;
  aab)
    ./gradlew bundleRelease
    ARTIFACT="app/build/outputs/bundle/release/app-release.aab"
    OUTPUT_FILE="$OUTPUT_DIR/aftertouch-release.aab"
    ;;
  *)
    echo "Usage: $0 [apk|aab]" >&2
    exit 1
    ;;
esac

if [ ! -f "$ARTIFACT" ]; then
  echo "Expected release artifact not found: $ARTIFACT" >&2
  exit 1
fi

cp "$ARTIFACT" "$OUTPUT_FILE"
echo "$OUTPUT_FILE"
