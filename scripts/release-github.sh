#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODE="${RELEASE_MODE:-apk}"
BUMP="${RELEASE_BUMP:-patch}"
REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${GIT_BRANCH:-}"
RELEASE_NOTES="${RELEASE_NOTES:-}"

usage() {
  cat >&2 <<EOF
Usage: $0 [options] [apk|aab] [patch|minor]

Builds the current version, tags it, publishes a GitHub release with the built artifact,
then bumps the version and pushes that bump commit.

Options:
  --patch         Bump patch version (default, e.g. 1.2.3 -> 1.2.4).
  --minor         Bump minor version and reset patch to zero (e.g. 1.2.3 -> 1.3.0).
  --bump TYPE     Set bump type to 'patch' or 'minor'.
  -h, --help      Show this help.

Environment:
  GIT_REMOTE      Git remote to push to. Defaults to origin.
  GIT_BRANCH      Branch to push the version bump to. Defaults to current branch.
  RELEASE_NOTES   Optional initial release notes text. Defaults to commit messages since the latest v* tag.
  RELEASE_EDITOR  Editor command for release notes. Defaults to VISUAL, EDITOR, or vi.
  RELEASE_BUMP    Version bump type ('patch' or 'minor'). Defaults to patch.
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

proposed_release_notes() {
  PREVIOUS_TAG=$(git tag --list 'v*' --sort=-version:refname | head -n 1)
  if [ -n "$PREVIOUS_TAG" ]; then
    NOTES=$(git log --pretty=format:'- %s' "$PREVIOUS_TAG..HEAD")
    if [ -z "$NOTES" ]; then
      NOTES="No commit messages since $PREVIOUS_TAG."
    fi
  else
    NOTES=$(git log --pretty=format:'- %s' HEAD)
    if [ -z "$NOTES" ]; then
      NOTES="No commit messages found."
    fi
  fi
  printf '%s\n' "$NOTES"
}

edit_release_notes() {
  NOTES_FILE=$(mktemp "${TMPDIR:-/tmp}/aftertouch-release-notes.XXXXXX")
  trap 'rm -f "$NOTES_FILE"' EXIT
  printf '%s\n' "$NOTES" > "$NOTES_FILE"

  RELEASE_EDITOR_COMMAND=${RELEASE_EDITOR:-${VISUAL:-${EDITOR:-vi}}}
  printf 'Edit release notes in %s, then save and close the editor.\n' "$NOTES_FILE"
  sh -c "$RELEASE_EDITOR_COMMAND \"\$1\"" release-notes-editor "$NOTES_FILE"

  NOTES=$(sed '/^[[:space:]]*#/d' "$NOTES_FILE")
  if [ -z "$(printf '%s' "$NOTES" | tr -d '[:space:]')" ]; then
    echo "Release notes are empty; refusing to publish." >&2
    exit 1
  fi
}

bump_version() {
  node - "$1" <<'NODE'
const fs = require('fs');

const bumpType = process.argv[2] || 'patch';

function bump(version, type) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error('Unsupported version format: ' + version);
  }
  const major = match[1];
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const extra = match[4];

  if (type === 'minor') {
    return `${major}.${minor + 1}.0${extra}`;
  }
  if (type === 'patch') {
    return `${major}.${minor}.${patch + 1}${extra}`;
  }
  throw new Error('Unsupported bump type: ' + type);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

if (packageJson.version !== appJson.expo.version) {
  throw new Error(`package.json version (${packageJson.version}) does not match app.json expo.version (${appJson.expo.version})`);
}

const nextVersion = bump(packageJson.version, bumpType);
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

while [ "$#" -gt 0 ]; do
  case "$1" in
    apk|aab)
      MODE="$1"
      ;;
    patch|minor)
      BUMP="$1"
      ;;
    --patch)
      BUMP="patch"
      ;;
    --minor)
      BUMP="minor"
      ;;
    --bump)
      if [ "$#" -lt 2 ]; then
        echo "--bump requires a type (patch|minor)." >&2
        exit 1
      fi
      BUMP="$2"
      shift
      ;;
    --bump=*)
      BUMP="${1#*=}"
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
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

case "$MODE" in
  apk|aab) ;;
  *)
    echo "Unknown release artifact mode: $MODE" >&2
    usage
    exit 1
    ;;
esac

case "$BUMP" in
  patch|minor) ;;
  *)
    echo "Unknown version bump type: $BUMP (expected 'patch' or 'minor')" >&2
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

if [ -n "$RELEASE_NOTES" ]; then
  NOTES="$RELEASE_NOTES"
else
  NOTES=$(proposed_release_notes)
fi
printf 'Proposed release notes for %s:\n%s\n' "$TAG" "$NOTES"
edit_release_notes

printf 'Final release notes for %s:\n%s\n' "$TAG" "$NOTES"
git tag -a "$TAG" -m "Release $TAG"
git push "$REMOTE" "$TAG"

gh release create "$TAG" "$ARTIFACT" --title "$TAG" --notes "$NOTES"

NEXT_VERSION=$(bump_version "$BUMP")
git add package.json package-lock.json app.json
git commit -m "Bump version to $NEXT_VERSION"
git push "$REMOTE" "$BRANCH"

printf 'Released %s and bumped version to %s\n' "$TAG" "$NEXT_VERSION"
