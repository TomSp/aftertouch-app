#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODE="${1:-apk}"
REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${GIT_BRANCH:-}"
RELEASE_NOTES="${RELEASE_NOTES:-}"

usage() {
  cat >&2 <<EOF
Usage: $0 [apk|aab]

Builds the current version, tags it, publishes a GitHub release with the built artifact,
then bumps the patch version and pushes that bump commit.

Environment:
  GIT_REMOTE      Git remote to push to. Defaults to origin.
  GIT_BRANCH      Branch to push the version bump to. Defaults to current branch.
  RELEASE_NOTES   Optional release notes text. Defaults to "Release <tag>".
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

current_version() {
  node -e "const p=require('./package.json'); const a=require('./app.json'); if (p.version !== a.expo.version) { console.error('package.json version (' + p.version + ') does not match app.json expo.version (' + a.expo.version + ')'); process.exit(1); } console.log(p.version);"
}

bump_patch_version() {
  node <<'NODE'
const fs = require('fs');

function bump(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error('Unsupported version format: ' + version);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}${match[4]}`;
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

if (packageJson.version !== appJson.expo.version) {
  throw new Error(`package.json version (${packageJson.version}) does not match app.json expo.version (${appJson.expo.version})`);
}

const nextVersion = bump(packageJson.version);
packageJson.version = nextVersion;
appJson.expo.version = nextVersion;
packageLock.version = nextVersion;
if (packageLock.packages && packageLock.packages['']) {
  packageLock.packages[''].version = nextVersion;
}

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync('package-lock.json', JSON.stringify(packageLock, null, 2) + '\n');
console.log(nextVersion);
NODE
}

case "$MODE" in
  apk|aab) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown release artifact mode: $MODE" >&2
    usage
    exit 1
    ;;
esac

cd "$ROOT_DIR"

require_command git
require_command node

if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to release with local changes. Commit or stash them first." >&2
  git status --short >&2
  exit 1
fi

require_command gh

if [ -z "$BRANCH" ]; then
  BRANCH=$(git branch --show-current)
fi
if [ -z "$BRANCH" ]; then
  echo "Unable to determine current branch. Set GIT_BRANCH explicitly." >&2
  exit 1
fi

VERSION=$(current_version)
TAG="v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists locally: $TAG" >&2
  exit 1
fi
if git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag already exists on $REMOTE: $TAG" >&2
  exit 1
fi
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "GitHub release already exists: $TAG" >&2
  exit 1
fi

"$ROOT_DIR/scripts/build-release.sh" "$MODE"
case "$MODE" in
  apk) ARTIFACT="$ROOT_DIR/build/artifacts/aftertouch-release.apk" ;;
  aab) ARTIFACT="$ROOT_DIR/build/artifacts/aftertouch-release.aab" ;;
esac
if [ ! -f "$ARTIFACT" ]; then
  echo "Release artifact was not created: $ARTIFACT" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Build changed the worktree; refusing to tag a dirty tree." >&2
  git status --short >&2
  exit 1
fi

git tag -a "$TAG" -m "Release $TAG"
git push "$REMOTE" "$TAG"

gh release create "$TAG" "$ARTIFACT" --title "$TAG" --notes "${RELEASE_NOTES:-Release $TAG}"

NEXT_VERSION=$(bump_patch_version)
git add package.json package-lock.json app.json
git commit -m "Bump version to $NEXT_VERSION"
git push "$REMOTE" "$BRANCH"

printf 'Released %s and bumped version to %s\n' "$TAG" "$NEXT_VERSION"
