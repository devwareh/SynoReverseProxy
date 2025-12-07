# Version Management

This document explains how versioning works in the Synology Reverse Proxy Manager project.

## Version Files

### Frontend Version

- **Location**: `frontend/src/utils/version.js`
- **Variable**: `APP_VERSION`
- **Current Version**: `1.0.0`

### Backend Version

- **Location**: `backend/app/core/version.py`
- **Variable**: `APP_VERSION`
- **Current Version**: `1.0.0`

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/) (SemVer) format: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes that are not backward compatible
- **MINOR** (1.0.0 → 1.1.0): New features that are backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes that are backward compatible

## How to Update Version

### 1. Update Frontend Version

Edit `frontend/src/utils/version.js`:

```javascript
export const APP_VERSION = "1.0.1"; // Update this
```

### 2. Update Backend Version

Edit `backend/app/core/version.py`:

```python
APP_VERSION = "1.0.1"  # Update this
```

### 3. Update package.json (Optional)

The `package.json` version is separate and used for npm package management:

```json
{
  "version": "1.0.1"
}
```

### 4. Update FastAPI App Version

The FastAPI app version is automatically synced from `backend/app/core/version.py` via import.

## Version Display

### Frontend

- Version is displayed in the footer of the application
- Accessible via `APP_VERSION` from `utils/version.js`

### Backend

- Version is available via API endpoint: `GET /version`
- Also included in root endpoint: `GET /`
- Used in FastAPI OpenAPI documentation

## Version Endpoints

### Get Version Information

```bash
# Get version info
curl http://localhost:18888/version

# Response:
{
  "version": "1.0.0",
  "api_version": "1.0.0"
}
```

### Root Endpoint

```bash
curl http://localhost:18888/

# Response:
{
  "message": "Synology Reverse Proxy API Ready!",
  "version": "1.0.0"
}
```

## Best Practices

1. **Keep versions in sync**: Frontend and backend should have the same version number
2. **Update on release**: Update version numbers when creating a new release/tag
3. **Commit version changes**: Always commit version updates with your release commits
4. **Tag releases**: Create git tags matching the version number (e.g., `v1.0.0`)

## Release Checklist

When creating a new release:

- [ ] Update `frontend/src/utils/version.js`
- [ ] Update `backend/app/core/version.py`
- [ ] Update `frontend/package.json` (if needed)
- [ ] Update `README.md` if version is mentioned
- [ ] Create git tag: `git tag v1.0.1`
- [ ] Push tag: `git push origin v1.0.1`
- [ ] Create release notes

## Example: Updating from 1.0.0 to 1.0.1

```bash
# 1. Update frontend version
# Edit frontend/src/utils/version.js
export const APP_VERSION = "1.0.1";

# 2. Update backend version
# Edit backend/app/core/version.py
APP_VERSION = "1.0.1"

# 3. Commit changes
git add frontend/src/utils/version.js backend/app/core/version.py
git commit -m "chore: Bump version to 1.0.1"

# 4. Create and push tag
git tag v1.0.1
git push origin v1.0.1
```

## Version History

| Version | Date | Changes         |
| ------- | ---- | --------------- |
| 1.0.0   | 2025 | Initial release |

