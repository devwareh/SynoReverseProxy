# Version Management

This project uses a centralized version management system with a single source of truth.

## Version File

The project version is stored in the `VERSION` file at the project root:

```
1.3.0
```

## How It Works

### Backend
- `backend/app/core/version.py` reads from `VERSION` file at runtime
- No manual updates needed

### Frontend
- `frontend/package.json` version is manually synced
- `frontend/src/utils/version.js` is auto-generated from `VERSION`
- Build process automatically syncs version before building

## Bumping Versions

### Automatic (Recommended)

Use the `bump-version.sh` script:

```bash
# Bump patch version (1.3.0 -> 1.3.1)
./bump-version.sh patch

# Bump minor version (1.3.0 -> 1.4.0)
./bump-version.sh minor

# Bump major version (1.3.0 -> 2.0.0)
./bump-version.sh major

# Set specific version
./bump-version.sh 2.1.0
```

This script will:
1. Update the `VERSION` file
2. Update `frontend/package.json`
3. Regenerate `frontend/src/utils/version.js`
4. Show you the next steps (commit, tag, push)

### Manual

If you need to update manually:

1. Edit `VERSION` file
2. Run `cd frontend && npm run sync-version`
3. Update `frontend/package.json` version field

## Docker Builds

The Docker build process automatically syncs versions:

- **Frontend Dockerfile**: Runs `npm run sync-version` before building
- **Backend**: Reads `VERSION` file at container startup

## CI/CD Integration

When creating releases:

1. Bump version: `./bump-version.sh minor`
2. Commit changes: `git add -A && git commit -m "chore: Bump version to X.Y.Z"`
3. Create tag: `git tag vX.Y.Z`
4. Push: `git push && git push --tags`

The GitHub Actions workflow will automatically build and publish Docker images with the correct version tag.

## Version Display

- **Backend API**: `/` endpoint returns version info
- **Frontend UI**: Footer displays version from `APP_VERSION`
- **Docker Images**: Tagged with version from `VERSION` file
