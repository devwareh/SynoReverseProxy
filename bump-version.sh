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

# Automate Git operations
echo "Performing Git operations..."

# Stage changes
git add VERSION frontend/package.json frontend/src/utils/version.js

# Commit
GIT_COMMIT_MSG="chore: bump version to $NEW_VERSION"
git commit -m "$GIT_COMMIT_MSG"
echo "✓ Committed changes: $GIT_COMMIT_MSG"

# Tag
GIT_TAG="v$NEW_VERSION"
git tag "$GIT_TAG"
echo "✓ Created tag: $GIT_TAG"

echo ""
echo "-------------------------------------------------------"
echo "Ready to push!"
echo "This will trigger the Docker Publish workflow."
echo "-------------------------------------------------------"
echo ""

read -p "Do you want to push commits and tags now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing to remote..."
    git push && git push --tags
    echo ""
    echo "🚀 Version $NEW_VERSION released!"
    echo "Check GitHub Actions for build status: https://github.com/devwareh/SynoReverseProxy/actions"
else
    echo ""
    echo "Skipped push."
    echo "To push manually, run:"
    echo "  git push && git push --tags"
fi
