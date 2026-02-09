#!/bin/bash
# Version bump script - updates VERSION file and syncs to all locations
# Usage: ./bump-version.sh [major|minor|patch|<version>]

set -e

VERSION_FILE="VERSION"

# Get current version
CURRENT_VERSION=$(cat "$VERSION_FILE")

# Parse version components
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Determine new version
case "$1" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  patch)
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  *)
    if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      NEW_VERSION="$1"
    else
      echo "Usage: $0 [major|minor|patch|<version>]"
      echo "Current version: $CURRENT_VERSION"
      exit 1
    fi
    ;;
esac

echo "Bumping version from $CURRENT_VERSION to $NEW_VERSION"

# Update VERSION file
echo "$NEW_VERSION" > "$VERSION_FILE"

# Sync to frontend
echo "Syncing to frontend..."
cd frontend
npm run sync-version
cd ..

# Update frontend package.json
echo "Updating frontend/package.json..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" frontend/package.json
rm frontend/package.json.bak

echo "✓ Version bumped to $NEW_VERSION"
echo ""
echo "Files updated:"
echo "  - VERSION"
echo "  - frontend/package.json"
echo "  - frontend/src/utils/version.js"
echo "  - backend/app/core/version.py (reads from VERSION at runtime)"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Commit: git add -A && git commit -m 'chore: Bump version to $NEW_VERSION'"
echo "  3. Tag: git tag v$NEW_VERSION"
echo "  4. Push: git push && git push --tags"
