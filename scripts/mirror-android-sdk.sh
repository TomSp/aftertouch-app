#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TARGET_DIR="$ROOT_DIR/sdk/android-sdk"
TMP_DIR="${TMPDIR:-/tmp}/aftertouch-android-sdk"
TOOLS_VERSION="15859902"
TOOLS_ZIP="commandlinetools-linux-${TOOLS_VERSION}_latest.zip"
TOOLS_URL="https://dl.google.com/android/repository/${TOOLS_ZIP}"
SDKMANAGER="$TARGET_DIR/cmdline-tools/latest/bin/sdkmanager"

if ! command -v java >/dev/null 2>&1; then
  echo "Java is required to run sdkmanager." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to download the Android SDK." >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required to unpack the Android SDK." >&2
  exit 1
fi

rm -rf "$TARGET_DIR" "$TMP_DIR"
mkdir -p "$TMP_DIR" "$TARGET_DIR/cmdline-tools" "$TARGET_DIR/licenses"

curl -fsSL "$TOOLS_URL" -o "$TMP_DIR/$TOOLS_ZIP"
unzip -q "$TMP_DIR/$TOOLS_ZIP" -d "$TMP_DIR/cmdline-tools"
mv "$TMP_DIR/cmdline-tools/cmdline-tools" "$TARGET_DIR/cmdline-tools/latest"

cat > "$TARGET_DIR/licenses/android-sdk-license" <<'EOF'
8933bad161af4178b1185d1a37fbf41ea5269c55
d56f5187479451eabf01fb78af6dfcb131a6481e
24333f8a63b6825ea9c5514f83c2829b004d1fee
EOF

cat > "$TARGET_DIR/licenses/android-sdk-preview-license" <<'EOF'
84831b9409646a918e30573bab4c9c91346d8abd
EOF

yes | "$SDKMANAGER" --sdk_root="$TARGET_DIR" --licenses >/dev/null
"$SDKMANAGER" --sdk_root="$TARGET_DIR" "platform-tools" "build-tools;36.0.0" "platforms;android-36" "ndk;27.1.12297006"

rm -rf "$TMP_DIR"
echo "$TARGET_DIR"
